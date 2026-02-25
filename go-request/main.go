package main

import (
	"bytes"
	"context"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

type FirmwareItem struct {
	Name    string    `json:"name"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mod_time"`
}

type Job struct {
	ID         string    `json:"id"`
	IP         string    `json:"ip"`
	Firmware   string    `json:"firmware"`
	Status     string    `json:"status"`
	Message    string    `json:"message"`
	Percent    int       `json:"percent"`
	CreatedAt  time.Time `json:"created_at"`
	StartedAt  time.Time `json:"started_at,omitempty"`
	FinishedAt time.Time `json:"finished_at,omitempty"`
}

type StartJobRequest struct {
	IP       string `json:"ip"`
	Username string `json:"username"`
	Password string `json:"password"`
	Firmware string `json:"firmware"`
}

type upgradeStatusXML struct {
	XMLName   xml.Name `xml:"upgradeStatus"`
	Upgrading string   `xml:"upgrading"`
	Percent   int      `xml:"percent"`
}

type jobStore struct {
	mu   sync.RWMutex
	jobs map[string]*Job
}

func (s *jobStore) set(j *Job) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[j.ID] = j
}

func (s *jobStore) get(id string) (*Job, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	j, ok := s.jobs[id]
	if !ok {
		return nil, false
	}
	cp := *j
	return &cp, true
}

func (s *jobStore) update(id string, fn func(*Job)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if j, ok := s.jobs[id]; ok {
		fn(j)
	}
}

var (
	firmwareDir = getEnv("FIRMWARE_DIR", "/data/firmwares")
	port        = getEnv("PORT", "8080")
	store       = &jobStore{jobs: make(map[string]*Job)}
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", withCORS(handleHealth))
	mux.HandleFunc("/api/firmwares", withCORS(handleListFirmwares))
	mux.HandleFunc("/api/jobs", withCORS(handleStartJob))
	mux.HandleFunc("/api/jobs/", withCORS(handleGetJob))

	addr := ":" + port
	log.Printf("go-request ouvindo em %s, firmwares em %s", addr, firmwareDir)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func withCORS(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type,Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next(w, r)
	}
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":           true,
		"service":      "go-request",
		"firmware_dir": firmwareDir,
		"time":         time.Now().UTC(),
	})
}

func handleListFirmwares(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	entries, err := os.ReadDir(firmwareDir)
	if err != nil {
		http.Error(w, fmt.Sprintf("erro lendo pasta de firmwares: %v", err), http.StatusInternalServerError)
		return
	}

	items := make([]FirmwareItem, 0)
	_ = entries // mantém validação de diretório existente
	err = filepath.WalkDir(firmwareDir, func(path string, d os.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		ext := strings.ToLower(filepath.Ext(d.Name()))
		if ext != ".dav" && ext != ".bin" && ext != ".digicap" && ext != ".zip" {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}
		rel, err := filepath.Rel(firmwareDir, path)
		if err != nil {
			return nil
		}
		items = append(items, FirmwareItem{
			Name:    filepath.ToSlash(rel),
			Size:    info.Size(),
			ModTime: info.ModTime(),
		})
		return nil
	})
	if err != nil {
		http.Error(w, fmt.Sprintf("erro varrendo pasta de firmwares: %v", err), http.StatusInternalServerError)
		return
	}

	sort.Slice(items, func(i, j int) bool {
		return items[i].ModTime.After(items[j].ModTime)
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"items": items,
		"count": len(items),
	})
}

func handleStartJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req StartJobRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "json inválido", http.StatusBadRequest)
		return
	}
	req.IP = strings.TrimSpace(req.IP)
	req.Username = strings.TrimSpace(req.Username)
	req.Firmware = strings.TrimSpace(req.Firmware)

	if req.IP == "" || req.Username == "" || req.Password == "" || req.Firmware == "" {
		http.Error(w, "campos obrigatórios: ip, username, password, firmware", http.StatusBadRequest)
		return
	}

	fullPath, err := resolveFirmwarePath(req.Firmware)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	st, err := os.Stat(fullPath)
	if err != nil || st.IsDir() {
		http.Error(w, "arquivo de firmware não encontrado", http.StatusBadRequest)
		return
	}

	jobID := fmt.Sprintf("job_%d", time.Now().UnixNano())
	job := &Job{
		ID:        jobID,
		IP:        req.IP,
		Firmware:  filepath.Base(req.Firmware),
		Status:    "queued",
		Message:   "job criado",
		Percent:   0,
		CreatedAt: time.Now().UTC(),
	}
	store.set(job)

	go runJob(jobID, req, fullPath)

	writeJSON(w, http.StatusAccepted, map[string]any{
		"job_id": jobID,
		"status": "queued",
	})
}

func resolveFirmwarePath(rel string) (string, error) {
	rel = strings.TrimSpace(rel)
	rel = strings.ReplaceAll(rel, "\\", "/")
	rel = pathClean(rel)
	if rel == "" || strings.HasPrefix(rel, "/") || strings.Contains(rel, "..") {
		return "", fmt.Errorf("caminho de firmware inválido")
	}
	full := filepath.Join(firmwareDir, filepath.FromSlash(rel))
	baseClean := filepath.Clean(firmwareDir)
	fullClean := filepath.Clean(full)
	basePrefix := baseClean + string(os.PathSeparator)
	if fullClean != baseClean && !strings.HasPrefix(fullClean, basePrefix) {
		return "", fmt.Errorf("caminho de firmware fora da pasta permitida")
	}
	return fullClean, nil
}

func pathClean(p string) string {
	p = strings.TrimSpace(p)
	p = strings.TrimPrefix(p, "./")
	p = strings.TrimPrefix(p, "/")
	return p
}

func handleGetJob(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	id := strings.TrimPrefix(r.URL.Path, "/api/jobs/")
	id = strings.TrimSpace(id)
	if id == "" {
		http.Error(w, "job id obrigatório", http.StatusBadRequest)
		return
	}

	job, ok := store.get(id)
	if !ok {
		http.Error(w, "job não encontrado", http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, job)
}

func runJob(jobID string, req StartJobRequest, fullPath string) {
	setJob(jobID, "uploading", "enviando firmware...", 0, false)

	stopEarlyMonitor := make(chan struct{})
	doneEarlyMonitor := make(chan struct{})
	go func() {
		defer close(doneEarlyMonitor)
		monitorUpgradeDuringUpload(jobID, req, stopEarlyMonitor)
	}()

	if err := uploadFirmware(req, fullPath); err != nil {
		close(stopEarlyMonitor)
		<-doneEarlyMonitor
		setJob(jobID, "failed", "falha no upload: "+err.Error(), 0, true)
		return
	}
	close(stopEarlyMonitor)
	<-doneEarlyMonitor

	setJob(jobID, "monitoring", "arquivo enviado, monitorando...", 0, false)

	if err := monitorUpgrade(jobID, req); err != nil {
		setJob(jobID, "failed", err.Error(), 0, true)
		return
	}

	setJob(jobID, "resetting", "resetando equipamento", 100, false)
	if err := resetDeviceBasic(req); err != nil {
		setJob(jobID, "failed", "falha ao resetar equipamento: "+err.Error(), 100, true)
		return
	}

	if err := waitDeviceOnline(jobID, req); err != nil {
		setJob(jobID, "failed", "reset enviado, mas equipamento não voltou online: "+err.Error(), 100, true)
		return
	}

	setJob(jobID, "done", "FINALIZADO UPDATE FIRMWARE", 100, true)
}

func uploadFirmware(req StartJobRequest, fullPath string) error {
	file, err := os.Open(fullPath)
	if err != nil {
		return err
	}
	defer file.Close()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("updateFile", "firmware.bin")
	if err != nil {
		return err
	}
	if _, err = io.Copy(part, file); err != nil {
		return err
	}
	if err = writer.Close(); err != nil {
		return err
	}

	url := fmt.Sprintf("http://%s/ISAPI/System/updateFirmware", req.IP)
	respBody, status, err := curlDigestRequest(
		req.Username, req.Password, http.MethodPost, url,
		writer.FormDataContentType(), body.Bytes(), 40*time.Minute,
	)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("HTTP %d - %s", status, trimResp(respBody))
	}
	return nil
}

func monitorUpgrade(jobID string, req StartJobRequest) error {
	statusURL := fmt.Sprintf("http://%s/ISAPI/System/upgradeStatus", req.IP)
	start := time.Now()
	noStartDeadline := 3 * time.Minute
	maxTotal := 35 * time.Minute
	seenUpgrade := false
	lastPercent := 0

	for time.Since(start) < maxTotal {
		body, statusCode, err := curlDigestRequest(
			req.Username, req.Password, http.MethodGet, statusURL,
			"", nil, 20*time.Second,
		)
		if err != nil {
			time.Sleep(3 * time.Second)
			continue
		}
		if statusCode != http.StatusOK {
			time.Sleep(3 * time.Second)
			continue
		}

		var st upgradeStatusXML
		if err := xml.Unmarshal([]byte(body), &st); err != nil {
			time.Sleep(3 * time.Second)
			continue
		}

		upgrading := strings.EqualFold(strings.TrimSpace(st.Upgrading), "true")
		if st.Percent > lastPercent {
			lastPercent = st.Percent
		}

		if upgrading {
			seenUpgrade = true
			setJob(jobID, "monitoring", fmt.Sprintf("atualizando... %d%%", lastPercent), lastPercent, false)
		} else if !seenUpgrade {
			if time.Since(start) > noStartDeadline {
				return fmt.Errorf("upload enviado, mas upgrade não iniciou")
			}
			setJob(jobID, "monitoring", "aguardando início da atualização...", lastPercent, false)
		} else {
			if lastPercent < 100 {
				lastPercent = 100
			}
			setJob(jobID, "monitoring", fmt.Sprintf("atualizando... %d%%", lastPercent), lastPercent, false)
			return nil
		}

		time.Sleep(3 * time.Second)
	}

	return fmt.Errorf("timeout monitorando atualização")
}

func resetDeviceBasic(req StartJobRequest) error {
	resetURL := fmt.Sprintf("http://%s/ISAPI/System/factoryReset?mode=basic", req.IP)
	respBody, status, err := curlDigestRequest(
		req.Username, req.Password, http.MethodPut, resetURL,
		"", nil, 60*time.Second,
	)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("HTTP %d - %s", status, trimResp(respBody))
	}
	return nil
}

func waitDeviceOnline(jobID string, req StartJobRequest) error {
	deviceInfoURL := fmt.Sprintf("http://%s/ISAPI/System/deviceInfo", req.IP)
	deadline := time.Now().Add(20 * time.Minute)
	attempt := 0

	for time.Now().Before(deadline) {
		attempt++
		setJob(jobID, "resetting", fmt.Sprintf("aguardando equipamento online... tentativa %d", attempt), 100, false)
		_, status, err := curlDigestRequest(
			req.Username, req.Password, http.MethodGet, deviceInfoURL,
			"", nil, 20*time.Second,
		)
		if err == nil && status == http.StatusOK {
			return nil
		}
		time.Sleep(5 * time.Second)
	}
	return fmt.Errorf("timeout aguardando equipamento online")
}

func monitorUpgradeDuringUpload(jobID string, req StartJobRequest, stop <-chan struct{}) {
	statusURL := fmt.Sprintf("http://%s/ISAPI/System/upgradeStatus", req.IP)
	lastPercent := 0

	for {
		select {
		case <-stop:
			return
		default:
		}

		body, statusCode, err := curlDigestRequest(
			req.Username, req.Password, http.MethodGet, statusURL,
			"", nil, 20*time.Second,
		)
		if err == nil && statusCode == http.StatusOK {
			var st upgradeStatusXML
			if xml.Unmarshal([]byte(body), &st) == nil {
				upgrading := strings.EqualFold(strings.TrimSpace(st.Upgrading), "true")
				if st.Percent > lastPercent {
					lastPercent = st.Percent
				}
				if upgrading {
					setJob(jobID, "uploading", fmt.Sprintf("atualizando... %d%%", lastPercent), lastPercent, false)
				}
			}
		}

		select {
		case <-stop:
			return
		case <-time.After(2 * time.Second):
		}
	}
}

func curlDigestRequest(username, password, method, url, contentType string, body []byte, timeout time.Duration) (string, int, error) {
	if timeout <= 0 {
		timeout = 65 * time.Second
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	args := []string{
		"--silent",
		"--show-error",
		"--digest",
		"-u", fmt.Sprintf("%s:%s", username, password),
		"-X", method,
		"-H", "Accept: */*",
		"-w", "\n%{http_code}",
		url,
	}
	if contentType != "" {
		args = append(args, "-H", "Content-Type: "+contentType)
	}
	if len(body) > 0 {
		args = append(args, "--data-binary", "@-")
	}

	cmd := exec.CommandContext(ctx, "curl", args...)
	if len(body) > 0 {
		cmd.Stdin = bytes.NewReader(body)
	}

	out, err := cmd.CombinedOutput()
	if ctx.Err() == context.DeadlineExceeded {
		return "", 0, fmt.Errorf("timeout na requisição para %s", url)
	}
	if err != nil {
		return "", 0, fmt.Errorf("curl falhou: %v - %s", err, string(out))
	}

	raw := string(out)
	lastNL := strings.LastIndex(raw, "\n")
	if lastNL < 0 {
		return raw, 0, fmt.Errorf("resposta inválida do curl")
	}

	bodyText := raw[:lastNL]
	codeText := strings.TrimSpace(raw[lastNL+1:])
	code, err := strconv.Atoi(codeText)
	if err != nil {
		return bodyText, 0, fmt.Errorf("status inválido do curl: %s", codeText)
	}
	return bodyText, code, nil
}

func setJob(id, status, msg string, percent int, done bool) {
	store.update(id, func(j *Job) {
		if j.StartedAt.IsZero() {
			j.StartedAt = time.Now().UTC()
		}
		j.Status = status
		j.Message = msg
		if percent >= 0 {
			j.Percent = percent
		}
		if done {
			j.FinishedAt = time.Now().UTC()
		}
	})
}

func trimResp(s string) string {
	t := strings.TrimSpace(s)
	if len(t) <= 240 {
		return t
	}
	return t[:240]
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func getEnv(k, def string) string {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	return v
}
