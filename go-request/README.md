# go-request (firmware backend)

Backend em Go para:
- listar firmwares na pasta montada;
- iniciar atualização no Hikvision;
- acompanhar progresso por job.

## Subir com Docker Compose

Na raiz do projeto:

```bash
docker compose up -d --build
```

Serviço exposto em:
- `http://localhost:18080`

Pasta de firmwares:
- `./firmwares` (host) -> `/data/firmwares` (container)

## Endpoints

- `GET /health`
- `GET /api/firmwares`
- `POST /api/jobs`
- `GET /api/jobs/{job_id}`

## Exemplo de start de job

```http
POST /api/jobs
Content-Type: application/json

{
  "ip": "10.0.138.4",
  "username": "admin",
  "password": "SUA_SENHA",
  "firmware": "digicap.dav"
}
```

Resposta:

```json
{
  "job_id": "job_1730000000000000000",
  "status": "queued"
}
```

Depois consultar:

`GET /api/jobs/job_1730000000000000000`

