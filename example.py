import tkinter as tk
from tkinter import ttk
from tkinter import filedialog
from tkinter import messagebox  
from tkinter import scrolledtext
from PIL import Image, ImageTk
import xml.etree.ElementTree as ET
import threading
import requests
from requests.auth import HTTPDigestAuth
import time
import subprocess
import io
import cv2
import customtkinter as ctk
import datetime
from requests.exceptions import RequestException
import base64
import hashlib
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5





# Inicializa a janela principal diretamente como janela de configuração
ctk.set_appearance_mode("dark")  # Modo de aparência escuro

# Variável global para controle do vídeo
is_streaming = False
cap = None
video_thread = None


# Definir variáveis globais
root = None
ok_icon = None
fail_icon = None
pending_icon = None
match_status_icon = None
fail_status_icon = None
audio_path_match_var = None
audio_path_fail_var = None
progress_label = None
check_device_info = None

# Variáveis globais para ícones
ok_icon = None
fail_icon = None
pending_icon = None
updating_icon = None
progress_var = None
progress_label = None
progress_bar = None
firmware_tab = None
image_label = None
display_label = None
ping_process = None
activate_device = None
status_status_label = None 
click_count = 0
magnetic_status_label = None
ultimo_status_magnetico = None
ultimo_status_online = None
serial_device = None


# Variáveis globais para labels
match_status_icon = None
fail_status_icon = None

def check_connection(ip, port, auth):
    try:
        # Tenta acessar a URL básica de status do dispositivo
        response = requests.get(f'http://{ip}:{port}/ISAPI/System/deviceInfo', auth=auth, timeout=3)
        if response.status_code == 200:
            return True
        else:
            return False
    except requests.RequestException:
        return False

def save_config(ip, port, username, password):
    with open('config.txt', 'w') as f:
        f.write(f'{ip}\n')
        f.write(f'{port}\n')
        f.write(f'{username}\n')
        f.write(f'{password}\n')

def load_config():
    try:
        with open('config.txt', 'r') as f:
            ip = f.readline().strip()
            port = f.readline().strip()
            username = f.readline().strip()
            password = f.readline().strip()
            return (ip, port, username, password)
    except FileNotFoundError:
        return ('', '', '', '')

def build_status_url(ip, port):
    # Construa a URL de status a partir do IP e porta fornecidos
    return f"http://{ip}:{port}/ISAPI/System/upgradeStatus"

###### GET MODEL 

# Função chamada ao clicar no botão "Check"
def check_device_info():
    # Executar as funções em threads separadas para evitar travamento da interface
    threading.Thread(target=get_device_info).start()
    threading.Thread(target=get_device_model_and_update_label).start()

# Função para obter a versão do dispositivo
def get_device_info():
    info_request_url = f'http://{ip_address}:{port}/ISAPI/System/deviceInfo'
    print(f"Requisitando informações do dispositivo em: {info_request_url}")  # Depuração
    try:
        response = requests.get(info_request_url, auth=auth)
        print(f"Código de resposta: {response.status_code}")  # Depuração
        if response.status_code == 200:
            data = response.text
            start_tag = '<firmwareReleasedDate>'
            end_tag = '</firmwareReleasedDate>'
            start_index = data.find(start_tag)
            end_index = data.find(end_tag)
            if start_index != -1 and end_index != -1:
                firmware_released_date = data[start_index + len(start_tag):end_index].strip()
            else:
                firmware_released_date = 'Não disponível'
            version_label.configure(text=f"Versão: {firmware_released_date}")  # Alterado para configure
        else:
            version_label.configure(text="Erro ao obter versão")  # Alterado para configure
            print(f"Erro na solicitação: {response.status_code}, Resposta: {response.text}")
    except requests.exceptions.RequestException as e:
        version_label.configure(text="Erro ao obter versão")  # Alterado para configure
        messagebox.showerror("Erro", f"Ocorreu um erro ao tentar obter as informações do dispositivo: {e}")

# Função para obter o modelo do dispositivo e atualizar o label
def get_device_model_and_update_label():
    try:
        model = get_device_model()
        model_label.configure(text=f"Modelo: {model}")  # Alterado para configure
    except Exception as e:
        model_label.configure(text="Erro ao obter modelo")  # Alterado para configure
        messagebox.showerror("Erro", f"Ocorreu um erro: {e}")

# Exemplo de função para obter o modelo do dispositivo
def get_device_model():
    model_request_url = f'http://{ip_address}:{port}/ISAPI/System/deviceInfo'
    print(f"Requisitando modelo do dispositivo em: {model_request_url}")  # Depuração
    try:
        response = requests.get(model_request_url, auth=auth)
        print(f"Código de resposta do modelo: {response.status_code}")  # Depuração
        if response.status_code == 200:
            log_message("Get Model Sucesso.")
            data = response.text
            start_tag = '<model>'
            end_tag = '</model>'
            start_index = data.find(start_tag)
            end_index = data.find(end_tag)
            if start_index != -1 and end_index != -1:
                return data[start_index + len(start_tag):end_index].strip()
            else:
                return "Não disponível"
                log_message("Não disponível.")
        else:
            return "Erro ao obter modelo"
            log_message("Erro ao obter modelo.")
    except requests.exceptions.RequestException:
        return "Erro de conexão"
        log_message("Erro de conexão.")

def get_device_serial(ip_address, port, auth):
    serial_request_url = f'http://{ip_address}:{port}/ISAPI/System/deviceInfo'
    print(f"Requisitando número de série em: {serial_request_url}")  # Depuração

    try:
        response = requests.get(serial_request_url, auth=auth)
        print(f"Código de resposta do serial: {response.status_code}")  # Depuração

        if response.status_code == 200:
            data = response.text
            start_tag = '<serialNumber>'
            end_tag = '</serialNumber>'
            start_index = data.find(start_tag)
            end_index = data.find(end_tag)
            if start_index != -1 and end_index != -1:
                full_serial = data[start_index + len(start_tag):end_index].strip()
                # Extrai os últimos 9 caracteres, que geralmente representam o serial real
                return full_serial[-9:] if len(full_serial) >= 9 else full_serial
            else:
                log_message("Número de série não disponível.")
                return "Não disponível"
        else:
            log_message("Erro ao obter número de série.")
            return "Erro ao obter número de série"
    except requests.exceptions.RequestException:
        log_message("Erro de conexão ao obter número de série.")
        return "Erro de conexão"

    
def check_serial(serial_var, ip_address, port, auth):
    serial = get_device_serial(ip_address, port, auth)
    serial_var.set(serial)

##### login

def reload_interface():
    root.destroy()  # Fecha a interface atual
    open_config_window()


def connect_and_load_main_interface():
    global ip_address, port, auth, base_url, username, password

    ip_address = ip_address_var.get()
    port = port_var.get()
    username = username_var.get()
    password = password_var.get()

    protocolo = "https" if port == "443" else "http"
    auth = requests.auth.HTTPDigestAuth(username, password)

    # 1. Verifica se está ativado
    ativado = check_device_activation(ip_address,port)

    if ativado is None:
        messagebox.showerror("Erro de Conexão", "Não foi possível consultar o status de ativação. Verifique o IP, porta ou conexão HTTPS.")
        return

    elif not ativado:
        deseja_ativar = messagebox.askyesno("Dispositivo não ativado", "O dispositivo ainda não foi ativado. Deseja ativá-lo agora?")
        if deseja_ativar:
            sucesso = realizar_ativacao(ip_address, port, password)
            if not sucesso:
                messagebox.showerror("Falha na Ativação", "Não foi possível ativar o dispositivo.")
                return
            else:
                messagebox.showinfo("Dispositivo Ativado", "Dispositivo ativado com sucesso! Conectando...")
        else:
            return  # Usuário não quis ativar, então interrompe aqui

    # 2. Verifica se o dispositivo está acessível
    if not check_connection(ip_address, port, auth):
        messagebox.showerror("Erro de Conexão", "Não foi possível conectar ao dispositivo. Verifique o endereço IP, a porta e as credenciais.")
        return

    base_url = f'{protocolo}://{ip_address}:{port}/ISAPI/System/configurationData'

    # 3. Fecha a janela de configuração se ainda estiver aberta
    if 'config_window' in globals() and config_window.winfo_exists():
        config_window.destroy()

    # 4. Carrega a interface principal
    load_main_interface()



def open_config_window():
    global config_window, ip_address_var, port_var, username_var, password_var

    ip_address, port, username, password = load_config()

    config_window = ctk.CTk()
    config_window.title("Autenticação")
    config_window.geometry("650x350")  # Aumentei a largura para dar mais espaço aos botões na lateral

    # Aplicando as cores personalizadas
    config_window.configure(fg_color="#1E1E2E")  # Cor de fundo principal

    title_label = ctk.CTkLabel(config_window, text="Autenticação", font=("Arial", 18, "bold"), text_color="#E0E0E0")
    title_label.grid(row=0, column=0, pady=20, columnspan=2)

    input_frame = ctk.CTkFrame(config_window, fg_color="#2A2A3B")  # Fundo dos inputs
    input_frame.grid(row=1, column=0, padx=20, pady=10, sticky="n")

    # Campos de entrada
    ctk.CTkLabel(input_frame, text="Endereço IP:", anchor="e", width=120, text_color="#E0E0E0").grid(row=0, column=0, padx=10, pady=10)
    ip_address_var = ctk.StringVar(value=ip_address)
    ip_entry = ctk.CTkEntry(input_frame, textvariable=ip_address_var, width=200, fg_color="#2A2A3B", text_color="#E0E0E0")
    ip_entry.grid(row=0, column=1, padx=10, pady=10)

    ctk.CTkLabel(input_frame, text="Porta:", anchor="e", width=120, text_color="#E0E0E0").grid(row=1, column=0, padx=10, pady=10)
    port_var = ctk.StringVar(value=port)
    port_entry = ctk.CTkEntry(input_frame, textvariable=port_var, width=200, fg_color="#2A2A3B", text_color="#E0E0E0")
    port_entry.grid(row=1, column=1, padx=10, pady=10)

    ctk.CTkLabel(input_frame, text="Usuário:", anchor="e", width=120, text_color="#E0E0E0").grid(row=2, column=0, padx=10, pady=10)
    username_var = ctk.StringVar(value=username)
    username_entry = ctk.CTkEntry(input_frame, textvariable=username_var, width=200, fg_color="#2A2A3B", text_color="#E0E0E0")
    username_entry.grid(row=2, column=1, padx=10, pady=10)

    ctk.CTkLabel(input_frame, text="Senha:", anchor="e", width=120, text_color="#E0E0E0").grid(row=3, column=0, padx=10, pady=10)
    password_var = ctk.StringVar(value=password)
    password_entry = ctk.CTkEntry(input_frame, textvariable=password_var, show="*", width=200, fg_color="#2A2A3B", text_color="#E0E0E0")
    password_entry.grid(row=3, column=1, padx=10, pady=10)

    # Criação do frame dos botões, agora ao lado do input_frame
    button_frame = ctk.CTkFrame(config_window, fg_color="#1E1E2E")
    button_frame.grid(row=1, column=1, padx=20, pady=25, sticky="n")

    remember_button = ctk.CTkButton(button_frame, text="Lembrar", width=200, fg_color="#8F7AC0", hover_color="#A594D6", text_color="#E0E0E0", command=lambda: save_config(
        ip_address_var.get(), port_var.get(), username_var.get(), password_var.get()
    ))
    remember_button.pack(pady=10)

    connect_button = ctk.CTkButton(button_frame, text="Conectar", width=200, fg_color="#8F7AC0", hover_color="#A594D6", text_color="#E0E0E0", command=connect_and_load_main_interface)
    connect_button.pack(pady=10)

    activate_button = ctk.CTkButton(button_frame, text="Ativar", width=200, fg_color="#FF6F61", hover_color="#FF7B73", text_color="#E0E0E0", command=activate_device)
    activate_button.pack(pady=10)

    config_window.mainloop()


######### Função para carregar ícones
def load_icons():
    global ok_icon, fail_icon, pending_icon, updating_icon, face_icon, bio_icon, card_icon, pass_icon, on_image, off_image
    try:
        ok_icon = ImageTk.PhotoImage(Image.open("ok.png").resize((20, 20)))
        fail_icon = ImageTk.PhotoImage(Image.open("fail.png").resize((20, 20)))
        pending_icon = ImageTk.PhotoImage(Image.open("pending.png").resize((20, 20)))
        updating_icon = ImageTk.PhotoImage(Image.open("updating.gif").resize((20, 20)))
        face_icon = ImageTk.PhotoImage(Image.open("face.png").resize((20, 20)))
        bio_icon = ImageTk.PhotoImage(Image.open("bio.png").resize((20, 20)))
        card_icon = ImageTk.PhotoImage(Image.open("card.png").resize((20, 20)))
        pass_icon = ImageTk.PhotoImage(Image.open("pass.png").resize((20, 20)))
        on_image = tk.PhotoImage(file="on.png")  # Imagem para 'ativado'
        off_image = tk.PhotoImage(file="off.png")  # Imagem para 'desativado'
    except Exception as e:
        print(f"Erro ao carregar ícones: {e}")

def show_frame(frame):
    frame.tkraise()

#####secrets
def on_help_button_click():
    global click_count
    click_count += 1
    if click_count >= 30:
        log_message("Get Model Sucesso.")
        click_count = 0  # Reseta o contador após registrar a mensagem
#####secrets

def load_main_interface():
    global version_label, firmware_path_var, export_status_label, import_status_label, ok_icon, fail_icon, pending_icon, progress_var, progress_label, progress_bar, pending_icon_label, model_label, firmware_tab
    global audio_path_match_var, audio_path_fail_var, match_status_icon, fail_status_icon, root, status_icon, status_icon_label
    global user_label_value, face_label_value, fingerprint_label_value, card_label_value, remote_label_value, display_label, cv2
    global user_status_icon, face_status_icon, fingerprint_status_icon, card_status_icon, remote_status_icon
    global check_device_info , status_status_label , label_click , help_button
    global firmware_tab, config_tab, routines_tab, monitoring_tab  # Definindo as abas
    global log_console  # Certifique-se de que esta linha venha antes de usar log_console
    global magnetic_status_label
    global serial_device , network_ip_var , network_subnet_var , network_gateway_var , network_mac_var , network_dns1_var , network_dns2_var , network_speed_var , network_mtu_var


    root = ctk.CTk()
    root.title("Atualização de Firmware e Configuração : V1.6")
    root.geometry("1180x600")

    network_ip_var = tk.StringVar(value="---")
    network_subnet_var = tk.StringVar(value="---")
    network_gateway_var = tk.StringVar(value="---")
    network_mac_var = tk.StringVar(value="---")
    network_dns1_var = tk.StringVar(value="---")
    network_dns2_var = tk.StringVar(value="---")
    network_speed_var = tk.StringVar(value="---")
    network_mtu_var = tk.StringVar(value="---")
    

    # Criação dos frames
    left_menu_frame = ctk.CTkFrame(root, fg_color='#1E1E2E')  # Azul escuro
    left_menu_frame.grid(row=0, column=0, sticky="nsew")

    right_content_frame = ctk.CTkFrame(root)
    right_content_frame.grid(row=0, column=1, sticky="nsew")

    # Configurações do grid
    right_content_frame.grid_rowconfigure(0, weight=1)
    right_content_frame.grid_columnconfigure(0, weight=1)
    root.grid_rowconfigure(0, weight=1)
    root.grid_columnconfigure(0, weight=1)
    root.grid_columnconfigure(1, weight=3)

###### ABA LATERAL
    ctk.CTkButton(left_menu_frame, text="Atualização de Firmware", command=lambda: show_frame(firmware_tab)).pack(padx=10, pady=5)
    ctk.CTkButton(left_menu_frame, text="Configuração", command=lambda: show_frame(config_tab)).pack(padx=10, pady=5)
    ctk.CTkButton(left_menu_frame, text="Rede", command=lambda: show_frame(network_tab)).pack(padx=10, pady=5)
    ctk.CTkButton(left_menu_frame, text="Rotinas", command=lambda: show_frame(routines_tab)).pack(padx=10, pady=5)
    ctk.CTkButton(left_menu_frame, text="Monitoramento", command=lambda: show_frame(monitoring_tab)).pack(padx=10, pady=5)
    ctk.CTkButton(left_menu_frame, text="Sair", command=reload_interface, fg_color="red").pack(padx=10, pady=5)

    # Labels
    version_label = ctk.CTkLabel(left_menu_frame, text="Versão: Carregando...")
    version_label.pack(padx=10, pady=5)

    model_label = ctk.CTkLabel(left_menu_frame, text="Modelo: Carregando...")
    model_label.pack(padx=10, pady=5)

    ctk.CTkButton(left_menu_frame, text="Check Versao", command=lambda: check_device_info()).pack(padx=10, pady=5)

    # Exemplo de criação do label no seu código
    status_status_label = ctk.CTkLabel(left_menu_frame, text="Device : ?????", fg_color='#A9A9A9', padx=10, pady=5)
    status_status_label.pack(padx=10, pady=5)

    # Botão para atualizar status magnético
    # update_magnetic_btn = ctk.CTkButton(left_menu_frame, text="Status Door", command=lambda: threading.Thread(target=get_magnetic_status, args=(magnetic_status_label,)).start())
    # update_magnetic_btn.pack(padx=10, pady=5)

    # Label para exibir status magnético
    magnetic_status_label = ctk.CTkLabel(left_menu_frame, text="--", fg_color='#A9A9A9', padx=10, pady=5)
    magnetic_status_label.pack(padx=10, pady=5)

###### ABA LATERAL

###### ABA INFERIOR
    bottom_frame = ctk.CTkFrame(root)
    bottom_frame.grid(row=1, column=0, columnspan=2, sticky="ew")  # Ajuste row e column conforme necessário

    # Criar o frame para os logs dentro da aba inferior (bottom_frame)
    log_frame = ctk.CTkFrame(bottom_frame)  # Agora dentro do bottom_frame
    log_frame.grid(row=0, column=0, padx=10, pady=10, sticky="ew")  # Posicionando com grid
    
    # Criar um Textbox para logs dentro do frame de logs
    log_console = ctk.CTkTextbox(log_frame, width=1000, height=100)  # Ajuste aqui para o tamanho desejado
    log_console.grid(row=0, column=0, padx=10, pady=10, sticky="ew")  # Usando grid para o posicionamento

    log_frame_inner_frame = ctk.CTkFrame(log_frame , corner_radius=1)
    log_frame_inner_frame.grid(row=0, column=1, columnspan=1, padx=1, pady=1, sticky="nsew")

    # Criar um botão "?" ao lado do log_console
    help_button = ctk.CTkButton(log_frame_inner_frame, text="?", command=on_help_button_click)  # Substitua a função conforme necessário
    help_button.grid(row=0, column=0, padx=(0, 0), pady=0, sticky="e")  # Sem margem
    

###### ABA INFERIOR
    device_model = get_device_model()

    # Aba de Atualização de Firmware
    firmware_tab = ctk.CTkFrame(right_content_frame, width=360, height=500)
    firmware_tab.grid(row=0, column=0, sticky="nsew")

    # Configurando o grid do firmware_tab
    firmware_tab.grid_rowconfigure(0, weight=1)
    firmware_tab.grid_columnconfigure(0, weight=1)

    firmware_info_frame = ctk.CTkFrame(firmware_tab, corner_radius=10)
    firmware_info_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

    # Função para copiar texto para a área de transferência
    def copy_to_clipboard(value):
        root.clipboard_clear()
        root.clipboard_append(value)
        root.update()  # Mantém o clipboard atualizado
   # Função para abrir o IP no navegador
    def open_ip_in_browser():
        import webbrowser
        webbrowser.open(f"http://{ip_address_var.get()}")
    
    
    # Endereço IP (readonly)
    ctk.CTkLabel(firmware_info_frame, text="Endereço IP:", anchor="w").grid(row=0, column=0, padx=10, pady=(5, 5), sticky="e")
    ip_address_var = tk.StringVar(value=ip_address)  # Use o IP que foi inserido no login
    ctk.CTkEntry(firmware_info_frame, textvariable=ip_address_var, width=200, state="readonly").grid(row=0, column=1, padx=10, pady=(5, 5), sticky="w")
    ctk.CTkButton(firmware_info_frame, text="Copiar", command=lambda: copy_to_clipboard(ip_address_var.get())).grid(row=0, column=2, padx=10, pady=(5, 5), sticky="w")
    ctk.CTkButton(firmware_info_frame, text=" 🌏 Navegador", command=open_ip_in_browser).grid(row=0, column=3, padx=5, pady=(5, 5), sticky="w")


    # Porta (readonly)
    ctk.CTkLabel(firmware_info_frame, text="Porta:", anchor="w").grid(row=1, column=0, padx=10, pady=(5, 5), sticky="e")
    port_var = tk.StringVar(value=port)  # Exemplo de porta
    ctk.CTkEntry(firmware_info_frame, textvariable=port_var, width=200, state="readonly").grid(row=1, column=1, padx=10, pady=(5, 5), sticky="w")
    
    # Arquivo de Firmware
    ctk.CTkLabel(firmware_info_frame, text="Arquivo de Firmware:", anchor="w").grid(row=2, column=0, padx=10, pady=(5, 5), sticky="e")
    firmware_path_var = tk.StringVar(value='digicap.dav')
    ctk.CTkEntry(firmware_info_frame, textvariable=firmware_path_var, width=200).grid(row=2, column=1, padx=10, pady=(5, 5), sticky="w")
    ctk.CTkButton(firmware_info_frame, text="Procurar", command=lambda: browse_dav_file()).grid(row=2, column=2, padx=10, pady=(5, 5), sticky="w")

    # Botão para iniciar atualização dentro do firmware_info_frame
    ctk.CTkButton(firmware_info_frame, text="Iniciar Atualização", command=start_update, fg_color="#3B8ED0", hover_color="#2E6FA5").grid(row=3, column=1, padx=10, pady=(20, 10), sticky="ew")

    # Campo de exibição do serial
    serial_device = ctk.CTkLabel(firmware_info_frame, text="Número de Série:", anchor="w").grid(row=4, column=0, padx=10, pady=(5, 5), sticky="e")
    serial_var = tk.StringVar(value="---")
    ctk.CTkEntry(firmware_info_frame, textvariable=serial_var, width=200, state="readonly").grid(row=4, column=1, padx=10, pady=(5, 5), sticky="w")

    # Botões: Checar e Copiar Serial
    ctk.CTkButton(firmware_info_frame, text="Check Serial", command=lambda: check_serial(serial_var, ip_address_var.get(), port_var.get(), auth)).grid(row=5, column=1, padx=10, pady=(5, 5), sticky="w")
    ctk.CTkButton(firmware_info_frame, text="Copy Serial", command=lambda: copy_to_clipboard(serial_var.get())).grid(row=5, column=2, padx=5, pady=(5, 5), sticky="w")

    # Progresso
    progress_var = tk.DoubleVar()
    progress_label = ctk.CTkLabel(firmware_tab, text="Pronto para iniciar...")
    progress_bar = ttk.Progressbar(firmware_tab, variable=progress_var, maximum=100)

    progress_label.grid(row=5, column=0, padx=10, pady=10)
    progress_bar.grid(row=5, column=1, columnspan=1, padx=10, pady=10)

    # Iniciar thread para buscar informações do dispositivo
    threading.Thread(target=get_device_model_and_update_label, args=(model_label,)).start()

 ############# Aba de Configuração
    config_tab = ctk.CTkFrame(right_content_frame)
    config_tab.grid(row=0, column=0, sticky="nsew")

    config_tab_inner_frame = ctk.CTkFrame(config_tab , corner_radius=10)
    config_tab_inner_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

    ctk.CTkButton(config_tab_inner_frame, text="Exportar Configuração", command=lambda: threading.Thread(target=export_configuration).start()).grid(row=0, column=0, padx=10, pady=10, sticky="w")
    export_status_label = ctk.CTkLabel(config_tab_inner_frame, text="Pendente")
    export_status_label.grid(row=0, column=1, padx=10, pady=10, sticky="w")

    ctk.CTkButton(config_tab_inner_frame, text="Importar Configuração",command=lambda: threading.Thread(target=start_import).start()).grid(row=1, column=0, padx=10, pady=10, sticky="w")
    import_status_label = ctk.CTkLabel(config_tab_inner_frame, text="Pendente")
    import_status_label.grid(row=1, column=1, padx=10, pady=10, sticky="w")

    ctk.CTkButton(config_tab_inner_frame, text="Reset Básico", command=lambda: threading.Thread(target=factory_reset, args=('basic',)).start()).grid(row=2, column=0, padx=10, pady=10, sticky="w")
    ctk.CTkButton(config_tab_inner_frame, text="Reset Completo", command=lambda: threading.Thread(target=factory_reset, args=('full',)).start()).grid(row=2, column=1, padx=10, pady=10, sticky="w")

    ctk.CTkButton(config_tab_inner_frame, text="Reiniciar Dispositivo", 
              command=lambda: threading.Thread(target=reboot_device).start(), 
              fg_color="orange", text_color="black").grid(row=2, column=2, padx=10, pady=20, sticky="w")
     
    if device_model == "DS-K1T673DX-BR":

        config_tab_inner_frame1 = ctk.CTkFrame(config_tab , corner_radius=10)
        config_tab_inner_frame1.grid(row=1, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        # Criar o label e o botão
        ctk.CTkLabel(config_tab_inner_frame1, text="Intertravamento:").grid(row=3, column=0, padx=10, pady=10, sticky="w")
        interlock_status_label = ctk.CTkLabel(config_tab_inner_frame1, text="Pendente",fg_color="gray")
        interlock_status_label.grid(row=3, column=1, padx=10, pady=10)
        # Criar botão para obter status
        ctk.CTkButton(
        config_tab_inner_frame1, 
        text="Obter Status", 
        command=lambda: threading.Thread(target=get_interlock_status, args=(interlock_status_label,)).start()
        ).grid(row=3, column=2, padx=10, pady=10, sticky="w")

        # Criar o label descritivo
        ctk.CTkLabel(config_tab_inner_frame1, text="SIP Status:").grid(row=4, column=0, padx=10, pady=10, sticky="w")

        # Criar o label onde o status será mostrado
        sip_status_label = ctk.CTkLabel(config_tab_inner_frame1, text="Pendente", fg_color="gray")
        sip_status_label.grid(row=4, column=1, padx=10, pady=10)

        # Criar botão para obter status do SIP
        ctk.CTkButton(
            config_tab_inner_frame1, 
            text="Obter SIP", 
            command=lambda: threading.Thread(target=verificar_sip_status, args=(sip_status_label,)).start()
        ).grid(row=4, column=2, padx=10, pady=10, sticky="w")

    elif device_model == "DS-K1T671MF-L":
        config_tab_inner_frame1 = ctk.CTkFrame(config_tab , corner_radius=10)
        config_tab_inner_frame1.grid(row=1, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        # Criar o label e o botão
        ctk.CTkLabel(config_tab_inner_frame1, text="Intertravamento:").grid(row=3, column=0, padx=10, pady=10, sticky="w")
        interlock_status_label = ctk.CTkLabel(config_tab_inner_frame1, text="Pendente",fg_color="gray")
        interlock_status_label.grid(row=3, column=1, padx=10, pady=10)
        # Criar botão para obter status
        ctk.CTkButton(
        config_tab_inner_frame1, 
        text="Obter Status", 
        command=lambda: threading.Thread(target=get_interlock_status, args=(interlock_status_label,)).start()
        ).grid(row=3, column=2, padx=10, pady=10, sticky="w")

        # Criar o label descritivo
        ctk.CTkLabel(config_tab_inner_frame1, text="SIP Status:").grid(row=4, column=0, padx=10, pady=10, sticky="w")

        # Criar o label onde o status será mostrado
        sip_status_label = ctk.CTkLabel(config_tab_inner_frame1, text="Pendente", fg_color="gray")
        sip_status_label.grid(row=4, column=1, padx=10, pady=10)

        # Criar botão para obter status do SIP
        ctk.CTkButton(
            config_tab_inner_frame1, 
            text="Obter SIP", 
            command=lambda: threading.Thread(target=verificar_sip_status, args=(sip_status_label,)).start()
        ).grid(row=4, column=2, padx=10, pady=10, sticky="w")

        
    elif device_model == "DS-K1T343MWX":
        config_tab_inner_frame1 = ctk.CTkFrame(config_tab , corner_radius=10)
        config_tab_inner_frame1.grid(row=1, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")
        ctk.CTkLabel(config_tab_inner_frame1, text="Modelo não suportado.").grid(row=1, column=0, padx=10, pady=10)


    network_tab = ctk.CTkFrame(right_content_frame)
    network_tab.grid(row=0, column=0, sticky="nsew")

    network_tab_inner_frame = ctk.CTkFrame(network_tab, corner_radius=10)
    network_tab_inner_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        # ---------------------- Informações de Rede ----------------------
    ctk.CTkLabel(network_tab_inner_frame, text="Informações de Rede", font=ctk.CTkFont(size=14, weight="bold")).grid(row=0, column=0, columnspan=3, padx=10, pady=(20, 5), sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="IP:").grid(row=1, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_ip_var, width=200, state="normal").grid(row=1, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="Máscara:").grid(row=2, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_subnet_var, width=200, state="normal").grid(row=2, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="Gateway:").grid(row=3, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_gateway_var, width=200, state="normal").grid(row=3, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="MAC:").grid(row=4, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_mac_var, width=200, state="readonly").grid(row=4, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="DNS Primário:").grid(row=5, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_dns1_var, width=200, state="normal").grid(row=5, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="DNS Secundário:").grid(row=6, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_dns2_var, width=200, state="normal").grid(row=6, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="Velocidade:").grid(row=7, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_speed_var, width=200, state="readonly").grid(row=7, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkLabel(network_tab_inner_frame, text="MTU:").grid(row=8, column=0, padx=10, pady=5, sticky="e")
    ctk.CTkEntry(network_tab_inner_frame, textvariable=network_mtu_var, width=200, state="readonly").grid(row=8, column=1, padx=10, pady=5, sticky="w")

    ctk.CTkButton(network_tab_inner_frame, text="Verificar Rede", command=lambda: preencher_info_rede()).grid(row=9, column=0, columnspan=2, padx=10, pady=10, sticky="w")

    ctk.CTkButton(network_tab_inner_frame, text="Salvar Configuração", command=lambda: threading.Thread(target=salvar_configuracao_rede).start()).grid(row=13, column=0, columnspan=2, padx=10, pady=10, sticky="w")




########### Aba de Rotinas
    routines_tab = ctk.CTkFrame(right_content_frame)
    routines_tab.grid(row=0, column=0, sticky="nsew")

    if device_model == "DS-K1T673DX-BR":

        routines_tab_inner_frame = ctk.CTkFrame(routines_tab , corner_radius=10)
        routines_tab_inner_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        audio_path_match_var = tk.StringVar(value='match.wav')
        audio_path_fail_var = tk.StringVar(value='fail.wav')

        ctk.CTkLabel(routines_tab_inner_frame, text="Arquivo match.wav:").grid(row=0, column=0, padx=10, pady=5, sticky="e")
        match_path_entry = ctk.CTkEntry(routines_tab_inner_frame, textvariable=audio_path_match_var, width=200, state="readonly")
        match_path_entry.grid(row=0, column=1, padx=10, pady=5, sticky="w")
        ctk.CTkButton(routines_tab_inner_frame, text="Procurar", command=lambda: browse_wav_file("match")).grid(row=0, column=2, padx=10, pady=5)

        # Adicionando um label para o status do envio do match
        match_status_label = ctk.CTkLabel(routines_tab_inner_frame, text="")
        match_status_label.grid(row=0, column=4, padx=10, pady=5)

        ctk.CTkButton(routines_tab_inner_frame, text="Enviar", command=lambda: send_match_audio(match_status_label)).grid(row=0, column=3, padx=10, pady=5)

        ctk.CTkLabel(routines_tab_inner_frame, text="Arquivo fail.wav:").grid(row=1, column=0, padx=10, pady=5, sticky="e")
        fail_path_entry = ctk.CTkEntry(routines_tab_inner_frame, textvariable=audio_path_fail_var, width=200, state="readonly")
        fail_path_entry.grid(row=1, column=1, padx=10, pady=5, sticky="w")
        ctk.CTkButton(routines_tab_inner_frame, text="Procurar", command=lambda: browse_wav_file("fail")).grid(row=1, column=2, padx=10, pady=5)

        # Adicionando um label para o status do envio do fail
        fail_status_label = ctk.CTkLabel(routines_tab_inner_frame, text="")
        fail_status_label.grid(row=1, column=4, padx=10, pady=5)

        ctk.CTkButton(routines_tab_inner_frame, text="Enviar", command=lambda: send_fail_audio(fail_status_label)).grid(row=1, column=3, padx=10, pady=5)

        # Adicionando um label para o status da rotina
        routine_status_label = ctk.CTkLabel(routines_tab_inner_frame, text="") 
        routine_status_label.grid(row=4, column=4, padx=10, pady=5)
        ctk.CTkButton(routines_tab_inner_frame, text="Enviar logo 673", command=lambda: start_routine(routine_status_label)).grid(row=4, column=3, padx=10, pady=5)
    else:
        # Se o dispositivo não for DS-K1T673DX-BR, pode adicionar uma mensagem ou deixar em branco
        routines_tab_inner_frame = ctk.CTkFrame(routines_tab , corner_radius=10)
        routines_tab_inner_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")
        ctk.CTkLabel(routines_tab_inner_frame, text="Modelo não suportado.").grid(row=0, column=0, padx=10, pady=10)

###################### MONITORAMENTO
    global status_label, door_status_icon_label , start_status , stop_status , video_label
    global user_count_label, face_count_label, card_count_label

    monitoring_tab = ctk.CTkFrame(right_content_frame)
    monitoring_tab.grid(row=0, column=0, sticky="nsew")

    monitoring_tab2_inner_frame = ctk.CTkFrame(monitoring_tab , corner_radius=10)
    monitoring_tab2_inner_frame.grid(row=1, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

    if device_model == "DS-K1T673DX-BR":
        monitoring_tab1_inner_frame = ctk.CTkFrame(monitoring_tab, corner_radius=10)
        monitoring_tab1_inner_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        # Adicionar elementos à aba de monitoramento
        ctk.CTkLabel(monitoring_tab1_inner_frame, text="USERS:").grid(row=0, column=0, padx=10, pady=10)
        user_label_value = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        user_label_value.grid(row=1, column=0, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="FACE:").grid(row=0, column=1, padx=10, pady=10)
        face_label_value = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        face_label_value.grid(row=1, column=1, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="FING:").grid(row=0, column=2, padx=10, pady=10)
        fingerprint_label_value = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        fingerprint_label_value.grid(row=1, column=2, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="CARD:").grid(row=0, column=3, padx=10, pady=10)
        card_label_value = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        card_label_value.grid(row=1, column=3, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="REMOTO:").grid(row=0, column=4, padx=10, pady=10)
        remote_label_value = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        remote_label_value.grid(row=1, column=4, padx=10, pady=(0, 10))

        # Adicionando um botão de atualizar
        update_button = ctk.CTkButton(monitoring_tab1_inner_frame, text="Atualizar", command=lambda: threading.Thread(target=get_user_info_count).start())
        update_button.grid(row=0, column=5, padx=(10, 0), pady=(20, 10), sticky="w")
    
    # Menu específico para DS-K1T671MF-L
    elif device_model == "DS-K1T671MF-L":

        monitoring_tab1_inner_frame = ctk.CTkFrame(monitoring_tab, corner_radius=10)
        monitoring_tab1_inner_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        # Adicionando elementos à aba de monitoramento para DS-K1T671MF-L
        ctk.CTkLabel(monitoring_tab1_inner_frame, text="USERS:").grid(row=0, column=0, padx=10, pady=10)
        user_count_label = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        user_count_label.grid(row=1, column=0, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="FACE:").grid(row=0, column=1, padx=10, pady=10)
        face_count_label = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        face_count_label.grid(row=1, column=1, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="CARD:").grid(row=0, column=3, padx=10, pady=10)
        card_count_label = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        card_count_label.grid(row=1, column=3, padx=10, pady=(0, 10))


        # Adicionando um botão de atualizar
        update_button = ctk.CTkButton(monitoring_tab1_inner_frame, text="Atualizar", command=lambda: threading.Thread(target=get_all_671).start())
        update_button.grid(row=0, column=5, padx=(10, 0), pady=(20, 10), sticky="w")

        # Menu específico para DS-K1T343MWX
    elif device_model == "DS-K1T343MWX":

        monitoring_tab1_inner_frame = ctk.CTkFrame(monitoring_tab, corner_radius=10)
        monitoring_tab1_inner_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")

        # Adicionando elementos à aba de monitoramento para DS-K1T671MF-L
        ctk.CTkLabel(monitoring_tab1_inner_frame, text="USERS:").grid(row=0, column=0, padx=10, pady=10)
        user_count_label = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        user_count_label.grid(row=1, column=0, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="FACE:").grid(row=0, column=1, padx=10, pady=10)
        face_count_label = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        face_count_label.grid(row=1, column=1, padx=10, pady=(0, 10))

        ctk.CTkLabel(monitoring_tab1_inner_frame, text="CARD:").grid(row=0, column=3, padx=10, pady=10)
        card_count_label = ctk.CTkLabel(monitoring_tab1_inner_frame, text="--")
        card_count_label.grid(row=1, column=3, padx=10, pady=(0, 10))

        # Adicionando um botão de atualizar
        update_button = ctk.CTkButton(monitoring_tab1_inner_frame, text="Atualizar", command=lambda: threading.Thread(target=get_all_671).start())
        update_button.grid(row=0, column=5, padx=(10, 0), pady=(20, 10), sticky="w")

    else:
        # Se o dispositivo não for DS-K1T673DX-BR, pode adicionar uma mensagem ou deixar em branco
        ctk.CTkLabel(monitoring_tab, text="Modelo não suportado para monitoramento.").grid(row=0, column=0, padx=10, pady=10)

    # Criar um frame para organizar a grade do vídeo
    video_frame = ctk.CTkFrame(monitoring_tab2_inner_frame)
    video_frame.grid(row=2, column=0, columnspan=7, pady=20)  # Ajuste o row e column conforme necessário

    # Configurar o rótulo para exibir o vídeo (sem texto) com tamanho fixo
    video_label = ctk.CTkLabel(video_frame, text="", width=350, height=250)  # Ajuste aqui para o tamanho desejado
    video_label.pack()  # Colocar o rótulo na grade

    # Criar um frame para os botões
    button_frame = ctk.CTkFrame(monitoring_tab2_inner_frame)
    button_frame.grid(row=3, column=0, columnspan=7, pady=10)  # Ajuste o row e column conforme necessário

    # Botão de Start
    start_button = ctk.CTkButton(button_frame, text="Start Stream", command=start_stream)
    start_button.pack(side=ctk.LEFT, padx=5)  # Lado esquerdo com espaçamento

    # Botão de Stop
    stop_button = ctk.CTkButton(button_frame, text="Stop Stream", command=stop_stream)
    stop_button.pack(side=ctk.LEFT, padx=5)  # Lado esquerdo com espaçamento

    # Botão para abrir a porta
    door_button = ctk.CTkButton(button_frame, text="Abrir Porta", command=abrir_porta)
    door_button.pack(side=ctk.LEFT, padx=5)  # Lado esquerdo com espaçamento

###### Chamada LOOP
    check_device_info()
    show_frame(firmware_tab)
    root.after(5000, verificar_status)
    preencher_info_rede()
    root.mainloop()

#função para adicionar log
def log_message(message):
    # Obter a data e hora atual
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Adicionar a mensagem ao log com data e hora
    log_console.insert("end", f"[{timestamp}] {message}\n")  # Adiciona a mensagem com timestamp
    log_console.see("end")  # Faz o textbox rolar para o final

######### ABRIR PORTA

def abrir_porta():
    url = f"http://{ip_address}:{port}/ISAPI/AccessControl/RemoteControl/door/1"
    # Cabeçalhos, se necessário
    headers = {
        "Content-Type": "application/xml"
    }
    # Payload (corpo da requisição)
    payload = """
    <RemoteControlDoor>
        <cmd>open</cmd>
    </RemoteControlDoor>
    """
    try:
        response = requests.put(url, data=payload, headers=headers, auth=HTTPDigestAuth(username, password), verify=False)
        
        if response.status_code == 200:
            # Atualiza a label de status para "ok"
            print("OPEN DOOR")
            log_message("Porta aberta com sucesso.")
            # Agendar a remoção do ícone após 5 segundos
        else:
            log_message("Falha ao abrir a porta")
            print(f"Erro: {response.status_code}")
            print(response.text)
    except Exception as e:
        log_message("Erro de conexão")
        print(f"Erro de conexão: {e}")



######## PEGAR SINCRONISMO 673

# Função para pegar informações do usuário
def get_user_info_count():
    url = f"http://{ip_address}/ISAPI/AccessControl/UserInfo/Count?format=json"
    try:
        # Atualiza o status para "Atualizando..." enquanto faz a solicitação
        #status_label.configure(text="Atualizando...")
        monitoring_tab.update_idletasks()

        # Fazer a solicitação GET
        response = requests.get(url, auth=auth, verify=False)

        # Verificar se a solicitação foi bem-sucedida
        if response.status_code == 200:
            # Atualiza o status para "Sucesso"
            log_message("Get_Users_info_count com sucesso")

            # Parsear o JSON de resposta
            data = response.json().get('UserInfoCount', {})
            
            # Extraindo os valores específicos
            user_number = data.get('userNumber', 0)
            face_number = data.get('bindFaceUserNumber', 0)
            fingerprint_number = data.get('bindFingerprintUserNumber', 0)
            card_number = data.get('bindCardUserNumber', 0)
            remote_number = data.get('bindRemoteControlNumber', 0)
            
            # Atualiza as labels com os valores recebidos
            user_label_value.configure(text=user_number)
            face_label_value.configure(text=face_number)
            fingerprint_label_value.configure(text=fingerprint_number)
            card_label_value.configure(text=card_number)
            remote_label_value.configure(text=remote_number)
            
        else:
            # Atualiza o status para "Falha" se a solicitação não for bem-sucedida
            log_message("Get_Users_info_count FALHA :{response.status_code}")
            print(f"Falha na solicitação. Código de status: {response.status_code}")
            print("Resposta:", response.text)

    except requests.RequestException as e:
        # Atualiza o status para "Erro" se houver uma exceção
        log_message("Get_Users_info_count FALHA :{e}")
        print(f"Ocorreu um erro ao fazer a solicitação: {e}")

def get_user_count671():
    url = f"http://{ip_address}:{port}/ISAPI/AccessControl/UserInfo/Count?format=json"
    
    try:
        response = requests.get(url, auth=HTTPDigestAuth(username, password))  # Adiciona a autenticação digest
        if response.status_code == 200:
            log_message("Get_Users_info_count com sucesso")
            user_count = response.json()['UserInfoCount']['userNumber']  # Retorna o contador de usuários
            user_count_label.configure(text=f"{user_count}")  # Atualiza a label com a contagem
        else:
            log_message("Get_Users_info_count FALHA :{response.status_code}")
            user_count_label.configure(text=f"Erro: Código {response.status_code}")
    except requests.RequestException as e:
        user_count_label.configure(text=f"Erro de conexão: {e}")

def get_face_count671():
    url = f"http://{ip_address}:{port}/ISAPI/Intelligent/FDLib/Count?format=json"
    
    try:
        response = requests.get(url, auth=HTTPDigestAuth(username, password))  # Adiciona a autenticação digest
        if response.status_code == 200:
            # Obtém o número de registros de face
            face_count = response.json()['FDRecordDataInfo'][0]['recordDataNumber']
            face_count_label.configure(text=f"{face_count}")  # Atualiza a label com a contagem
        else:
            face_count_label.configure(text=f"Erro: Código {response.status_code}")
    except requests.RequestException as e:
        face_count_label.configure(text=f"Erro de conexão: {e}")

def get_card_count671():
    url = f"http://{ip_address}:{port}/ISAPI/AccessControl/CardInfo/Count?format=json"
    
    try:
        response = requests.get(url, auth=HTTPDigestAuth(username, password))  # Autenticação digest
        if response.status_code == 200:
            # Obtém o número de cartões
            card_count = response.json()['CardInfoCount']['cardNumber']
            # Se você tiver uma label na interface para exibir, descomente a linha abaixo
            card_count_label.configure(text=f"{card_count}")
        else:
            print(f"Erro: Código {response.status_code}")
    except requests.RequestException as e:
        print(f"Erro de conexão: {e}")

def get_all_671():
    get_user_count671()
    get_face_count671()
    get_card_count671()


############### UPDATE

def browse_dav_file():
    file_path = filedialog.askopenfilename(initialdir='.', filetypes=[("Arquivos DAV", "*.dav")])
    if file_path:
        firmware_path_var.set(file_path)  # Define o caminho do arquivo selecionado para a variável firmware_path_var

def start_update():
    global progress_bar
    firmware_file_path = firmware_path_var.get()
    request_url = f'http://{ip_address}:{port}/ISAPI/System/updateFirmware'


    # Mostra a barra de progresso e o rótulo
    progress_bar.grid(row=5, column=1, columnspan=1, padx=10, pady=10)
    progress_label.configure(text="Atualizando firmware...")

    start_monitoring()
    # Inicia a atualização de firmware em uma nova thread
    threading.Thread(target=start_firmware_update, args=(firmware_file_path, request_url, auth)).start()

def start_monitoring():
    global username, password, ip_address, port, progress_var, progress_label  # Inclua as variáveis necessárias

    status_request_url = build_status_url(ip_address, port)
    auth = HTTPDigestAuth(username, password)  # Cria o objeto de autenticação corretamente

    # Iniciar monitoramento em uma nova thread
    monitor_thread = threading.Thread(target=monitor_progress, args=(status_request_url, auth, progress_var, progress_label))
    monitor_thread.start()

def monitor_progress(status_request_url, auth, progress_var, progress_label):
    progress_label.configure(text="Monitoramento iniciado...")
    percent = 0
    while True:
        try:
            # Envia a solicitação e recebe a resposta
            response = requests.get(status_request_url, auth=auth)
            response.raise_for_status()  # Lança uma exceção para códigos de status HTTP não 200
        except requests.RequestException as e:
            log_message("Erro", f"Erro na solicitação: {e}")
            break

        # Analisa a resposta XML
        response_text = response.text
        upgrading_status = '<upgrading>true</upgrading>' in response_text
        percent_start = response_text.find('<percent>') + len('<percent>')
        percent_end = response_text.find('</percent>')
        new_percent = int(response_text[percent_start:percent_end])

        # Atualiza a barra de progresso
        if upgrading_status:
            percent = new_percent
            progress_var.set(percent)
            progress_label.configure(text=f"Atualizando: {percent}%")
        else:
            progress_label.configure(text="Aguardando início da atualização...")
            time.sleep(10)  # Atraso para aguardar início da atualização
            continue
        
        # Verifica se a atualização está quase concluída
        if percent >= 99:
            while True:
                response = requests.get(status_request_url, auth=auth)
                response.raise_for_status()  # Lança uma exceção para códigos de status HTTP não 200
                response_text = response.text
                upgrading_status = '<upgrading>false</upgrading>' in response_text
                if upgrading_status:
                    break
                time.sleep(5)  # Verifica a cada 5 segundos se o upgrade terminou

            # Quando o status for FALSE e a porcentagem é 99 ou mais, considera concluído
            progress_label.configure(text="Atualização concluída.")
            progress_var.set(0)  # Redefine a barra de progresso para 0
            progress_label.configure(text="Atualização concluída.")
            break

        # Espera de 3 segundos antes de verificar novamente
        time.sleep(3)

    # Chama o script de exportação de configuração
    subprocess.run(['python', 'export_config.py'])

def start_firmware_update(firmware_file_path, request_url, auth):
    files = {
        'updateFile': ('firmware.bin', open(firmware_file_path, 'rb'), 'application/octet-stream')
    }
    try:
        response = requests.post(request_url, headers={'Content-Type': 'multipart/form-data'}, auth=auth, files=files)
        if response.status_code == 200:
            log_message("Sucesso", "Concluída atualização de firmware.")
            return True
        else:
            log_message("Erro", f"Falha na atualização. Código de status: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        log_message("Erro", f"Ocorreu um erro: {e}")
        return False

######### EXPORT IMPORT REBOOT RESET

def factory_reset(mode):
    reset_url = f'http://{ip_address}:{port}/ISAPI/System/factoryReset?mode={mode}'
    reboot_url = f'http://{ip_address}:{port}/ISAPI/System/reboot'
    try:
        # Verifica o tipo de solicitação esperado pela API
        response = requests.put(reset_url, auth=auth)
        if response.status_code == 200:
            response = requests.put(reboot_url, auth=auth)  # Reinicia o dispositivo após o reset
            log_message("Sucesso Dispositivo Reiniciado com sucesso.")
            if response.status_code == 200:
                log_message("Sucesso Dispositivo resetado com sucesso, Reiniciando.")
            else:
                log_message("Erro Falha ao reiniciar o dispositivo. Código de status: {response.status_code}")
        else:
            log_message("Erro Falha ao resetar dispositivo. Código de status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        log_message("Erro Ocorreu um erro: {e}")


# Função para exportar a configuração
def export_configuration():
    base_url = f'http://{ip_address}:{port}/ISAPI/System/configurationData'
    secret, iv = load_secret_and_iv()
    request_url = f'{base_url}?security=1&iv={iv}&secretkey={secret}'

    try:
        # Atualiza o status sem ícones
        export_status_label.configure(text="Exportando...")  # Mensagem de pendente
        response = requests.get(request_url, auth=auth)

        if response.status_code == 200:
            with open('configurationData', 'wb') as file:
                file.write(response.content)
            export_status_label.configure(text="Sucesso.")  # Mensagem de sucesso
            log_message("Sucesso Exportação concluída com sucesso.")
        else:
            export_status_label.configure(text="Falha.")  # Mensagem de falha
            print(f"Falha na exportação. Código de status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        export_status_label.configure(text="Erro.")  # Mensagem de falha
        print(f"Ocorreu um erro: {e}")

def import_configuration():
    import_url = f'http://{ip_address}:{port}/ISAPI/System/configurationData'
    reboot_url = f'http://{ip_address}:{port}/ISAPI/System/reboot'
    try:
        import_status_label.configure(text="Importando...")  # Mensagem de pendente
        secret, iv = load_secret_and_iv()
        request_url = f'{import_url}?security=1&iv={iv}&secretkey={secret}'
        with open('configurationData', 'rb') as file:
            data = file.read()
        response = requests.post(request_url, auth=auth, data=data)
        if response.status_code == 200:
            response = requests.put(reboot_url, auth=auth)
            import_status_label.configure(text="Sucesso, Reiniciando")  # Mensagem de sucesso
            log_message("Sucesso Configuração importada com sucesso, Reiniciando")
        else:
            import_status_label.configure(text="Falha.")  # Mensagem de falha
            log_message("Erro Falha na importação. Código de status: {response.status_code}")
    except requests.exceptions.RequestException as e:
        import_status_label.configure(text="Erro.")  # Mensagem de falha
        log_message("Erro Ocorreu um erro: {e}")

def start_import():
    # Inicia a importação em uma nova thread
    import_thread = threading.Thread(target=import_configuration)
    import_thread.start()

def reboot_device():
    reboot_url = f'http://{ip_address}:{port}/ISAPI/System/reboot'
    try:
        response = requests.put(reboot_url, auth=auth)
        if response.status_code == 200:
            log_message("Dispositivo reiniciando com sucesso.")
        else:
            log_message("Erro")
    except requests.exceptions.RequestException as e:
        log_message("Erro")



# Função para carregar o segredo e o IV
def load_secret_and_iv():
    secret = "6a732dbffc0df754140a7895b89fddac"
    iv = "2e3a0d1d092fec3efd0fc0bdb2224d43"
    return secret, iv

################# ROTINAS / ENVIO DE IMAGE / AUDIO

def browse_dav_file():
    file_path = filedialog.askopenfilename(initialdir='.', filetypes=[("Arquivos DAV", "*.dav")])
    if file_path:
        firmware_path_var.set(file_path)  # Define o caminho do arquivo selecionado para a variável firmware_path_var

def browse_wav_file(audio_type):
    file_path = filedialog.askopenfilename(initialdir='.', filetypes=[("Arquivos WAV", "*.wav")])
    if file_path:
        if audio_type == "match":
            audio_path_match_var.set(file_path)
        elif audio_type == "fail":
            audio_path_fail_var.set(file_path)
            firmware_path_var.set(file_path)

def send_match_audio(status_label):
    match_path = audio_path_match_var.get()
    if match_path:
        print(f"Enviando áudio para: {match_path}")

        # Atualiza o status enquanto o envio está em progresso
        root.update_idletasks()
        
        success = send_audio(match_path, "thanks")
        if success:
            print(text="Sucesso!")
        else:
            print(text="false!")

    else:
        log_message("Aviso", "Nenhum arquivo match.wav selecionado.")

def send_fail_audio(status_label):
    fail_path = audio_path_fail_var.get()
    if fail_path:
        print(f"Enviando áudio para: {fail_path}")

        # Atualiza o status enquanto o envio está em progresso
        root.update_idletasks()
        
        success = send_audio(fail_path, "verifyFailed")
        if success:
            print(text="Sucesso!")
        else:
            print(text="false!")
    else:
        log_message("Aviso", "Nenhum arquivo fail.wav selecionado.")

def send_audio(file_path, custom_audio_type):
    api_url = f"http://{ip_address}:{port}/ISAPI/AccessControl/customAudio/addCustomAudio?format=json"
    
    # Dados do áudio para enviar como form-data
    data = {
        "CustomAudioInfo": f'{{"customAudioType":"{custom_audio_type}","filePathType":"binary"}}'
    }
    
    # Envio do arquivo
    files = {
        "File_Name": (file_path, open(file_path, 'rb'), 'audio/wav')
    }
    
    try:
        # Envia a solicitação POST com o arquivo e os dados
        response = requests.post(api_url, data=data, files=files, auth=auth)
        
        # Verifica o status da resposta
        if response.status_code == 200:
            log_message("Arquivo enviado com sucesso!")
            print("Resposta:", response.json())  # Ou `response.text` se a resposta não for JSON
            return True
        else:
            log_message(f"Falha ao enviar arquivo. Código de status: {response.status_code}")
            print("Resposta:", response.text)
            return False
    except requests.RequestException as e:
        log_message(f"Ocorreu um erro: {e}")
        return False

######## ROTINA IMAGEM FUNDO



def start_routine(status_label):
    # Atualiza o status para "pending" (em progresso)
    log_message("Status: Em progresso...")

    # Cria e inicia uma nova thread para a função rotina673
    threading.Thread(target=rotina673, args=(status_label,)).start()

def rotina673(status_label):
    try:
        post_program()
        update_schedule()
        post_material()
        upload_file()
        update_page()
        # Atualiza o status para "ok" (sucesso)
        log_message("Status: Sucesso!")
    except Exception as e:
        log_message(f"Ocorreu um erro na rotina: {e}")
        # Atualiza o status para "fail" (falha)
        log_message("Status: Falha!")

def post_program():
    url = f"http://{ip_address}:{port}/ISAPI/Publish/ProgramMgr/program"
    xml_file_path = 'rotina1.xml'
    headers = {'Content-Type': 'application/xml'}
    try:
        with open(xml_file_path, 'r') as xml_file:
            xml_data = xml_file.read()
        response = requests.post(url, data=xml_data, auth=auth, headers=headers, verify=False)
        if response.status_code == 200:
            print("POST Program enviado com sucesso!")
            print("Resposta:", response.text)
        else:
            print(f"Falha ao enviar o POST Program. Código de status: {response.status_code}")
            print("Resposta:", response.text)
    except requests.RequestException as e:
        print(f"Ocorreu um erro: {e}")

def update_schedule():
    url = f"http://{ip_address}:{port}/ISAPI/Publish/ScheduleMgr/playSchedule/1"
    headers = {'Content-Type': 'application/xml'}
    
    # XML para ser enviado
    xml_data = '''<?xml version="1.0" encoding="utf-8"?>
    <PlaySchedule xmlns="http://www.isapi.org/ver20/XMLSchema" version="2.0">
        <id>1</id>
        <scheduleName>web</scheduleName>
        <scheduleMode>screensaver</scheduleMode>
        <scheduleType>daily</scheduleType>
        <DailySchedule>
            <PlaySpanList>
                <PlaySpan>
                    <id>1</id>
                    <programNo>1</programNo>
                    <TimeRange>
                        <beginTime>00:00:00</beginTime>
                        <endTime>23:59:59</endTime>
                    </TimeRange>
                </PlaySpan>
            </PlaySpanList>
        </DailySchedule>
    </PlaySchedule>'''

    try:
        response = requests.put(url, data=xml_data, auth=auth, headers=headers, verify=False)
        if response.status_code == 200:
            print("PUT Schedule enviado com sucesso!")
            print("Resposta:", response.text)
        else:
            print(f"Falha ao enviar o PUT Schedule. Código de status: {response.status_code}")
            print("Resposta:", response.text)
    except requests.RequestException as e:
        print(f"Ocorreu um erro: {e}")
def post_material():
    url = f"http://{ip_address}:{port}/ISAPI/Publish/MaterialMgr/material"
    headers = {'Content-Type': 'application/xml', 'Accept': 'application/xml'}
    data = """
    <Material>
        <id>0</id>
        <materialName>Modelo 671</materialName>
        <materialRemarks></materialRemarks>
        <materialType>static</materialType>
        <approveState>notApprove</approveState>
        <approveRemarks></approveRemarks>
        <shareProperty>private</shareProperty>
        <uploadUser>admin</uploadUser>
        <uploadTime>2024-08-21 18:54:38</uploadTime>
        <orgNo>undefined</orgNo>
        <replaceTerminal></replaceTerminal>
        <StaticMaterial>
            <staticMaterialType>picture</staticMaterialType>
            <picFormat>jpg</picFormat>
            <fileSize>188322</fileSize>
        </StaticMaterial>
    </Material>
    """
    try:
        response = requests.post(url, headers=headers, data=data, auth=auth, verify=False)
        response.raise_for_status()
        print("POST Material:", response.text)
    except requests.RequestException as e:
        print(f"Ocorreu um erro ao enviar material: {e}")

def upload_file():
    url = f"http://{ip_address}:{port}/ISAPI/Publish/MaterialMgr/material/4/upload"
    files = {'file': ('Modelo 671.jpg', open('Modelo 671.jpg', 'rb'), 'image/jpeg')}
    data = {
        'name': 'Modelo 671',
        'type': 'image/jpeg',
        'size': '188322'
    }
    try:
        response = requests.post(url, data=data, files=files, auth=auth, verify=False)
        response.raise_for_status()
        print("Upload de arquivo:", response.text)
    except requests.RequestException as e:
        print(f"Ocorreu um erro ao fazer upload do arquivo: {e}")

def update_page():
    url = f"http://{ip_address}:{port}/ISAPI/Publish/ProgramMgr/program/1/page/1"
    xml_data = """<?xml version="1.0" encoding="UTF-8"?>
    <Page xmlns="http://www.isapi.org/ver20/XMLSchema" version="2.0">
        <id>1</id>
        <PageBasicInfo>
            <pageName>1</pageName>
            <playDurationMode>1</playDurationMode>
            <switchDuration>1</switchDuration>
            <switchEffect>none</switchEffect>
        </PageBasicInfo>
        <WindowsList>
            <Windows>
                <id>1</id>
                <Position>
                    <positionX>33</positionX>
                    <positionY>304</positionY>
                    <height>1920</height>
                    <width>1920</width>
                </Position>
                <layerNo>1</layerNo>
                <WinMaterialInfo>
                    <materialType>static</materialType>
                    <staticMaterialType>picture</staticMaterialType>
                </WinMaterialInfo>
                <PlayItemList>
                    <PlayItem>
                        <id>1</id>
                        <materialNo>4</materialNo>
                        <playEffect>none</playEffect>
                        <PlayDuration>
                            <durationType>materialTime</durationType>
                            <duration>1</duration>
                        </PlayDuration>
                    </PlayItem>
                </PlayItemList>
            </Windows>
        </WindowsList>
    </Page>"""
    headers = {"Content-Type": "application/xml"}
    try:
        response = requests.put(url, data=xml_data, headers=headers, auth=auth, verify=False)
        response.raise_for_status()
        print("Atualização da página:", response.text)
    except requests.RequestException as e:
        print(f"Ocorreu um erro ao atualizar a página: {e}")

############ VIDEO ########

# Função para capturar o vídeo RTSP
def capturar_video_rtsp():
    global cap, is_streaming

    # URL configurável do stream RTSP
    rtsp_url = f"rtsp://{username}:{password}@{ip_address}:554/ISAPI/Streaming/channels/102"
    cap = cv2.VideoCapture(rtsp_url)

    if not cap.isOpened():
        log_message("Erro ao conectar com o stream RTSP")
        is_streaming = False
        return

    while is_streaming:
        ret, frame = cap.read()
        
        if not ret:
            log_message("Falha ao receber frame do stream")
            break
        
        # Converter o frame para imagem RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        img = Image.fromarray(frame_rgb)

        # Criar CTkImage a partir da imagem PIL
        imgtk = ctk.CTkImage(img, size=(350, 250))  # Ajuste o tamanho se necessário
        
        # Atualizar a imagem no rótulo da GUI
        video_label.imgtk = imgtk
        video_label.configure(image=imgtk)
        
        # Atualizar o frame a cada 10ms
        video_label.after(10, lambda: None)
    
    # Liberar a captura de vídeo após o loop
    cap.release()
    cv2.destroyAllWindows()

# Iniciar o stream
def start_stream():
    global is_streaming, video_thread
    if not is_streaming:
        is_streaming = True
        print("Stream iniciado...")
        log_message("Iniciando o stream...")
        video_thread = threading.Thread(target=capturar_video_rtsp)
        video_thread.start()

# Parar o stream
def stop_stream():
    global is_streaming
    if is_streaming:
        is_streaming = False
        print("Parando stream...")
        log_message("Stream parado.")

        # Utilizar video_label.after para verificar o término da thread sem bloquear a interface
        def check_thread():
            if video_thread.is_alive():
                video_label.after(100, check_thread)
            else:
                print("Stream parado.")
        
        check_thread()

################# CHECK ONLINE #########################      
def check_equipamento_online():
    global ultimo_status_online

    url = f"http://{ip_address}:{port}/"

    for attempt in range(2):  # Tentar duas vezes
        try:
            response = requests.get(url, verify=False, timeout=1)
            if response.status_code == 200:
                if ultimo_status_online != "online":
                    update_status("Device : Online", "green")
                    log_message("Status Online")  # Só loga se mudou
                    ultimo_status_online = "online"
                return
        except RequestException:
            pass

    # Se chegou aqui, está offline
    if ultimo_status_online != "offline":
        update_status("Device : Offline", "red")
        log_message("Status Offline")  # Só loga se mudou
        ultimo_status_online = "offline"

    update_status("Device : Offline", "red")  # Atualiza o status para offline se ambas as tentativas falharem

def update_status(message, color):
    """Atualiza o status do label com a mensagem e a cor especificadas."""
    if status_status_label:  # Verifica se o label foi inicializado
        status_status_label.configure(text=message, fg_color=color)

def verificar_status():

    # Atualiza status online/offline
    status = check_equipamento_online()
    status_status_label.configure(text=status)  # Atualiza o label do status geral

    # Atualiza status magnético em paralelo (para não travar UI)
    threading.Thread(target=get_magnetic_status, args=(magnetic_status_label,), daemon=True).start()

    # Reagenda a verificação em 5 segundos
    root.after(5000, verificar_status)


################# CHECK ONLINE #########################      

def get_interlock_status(label):
    url = f'http://{ip_address}:{port}/ISAPI/System/Network/SIP/MultiDoorInterlock?format=json'
    try:
        response = requests.get(url, auth=auth)
        if response.status_code == 200:
            data = response.json()
            status = data.get("multiDoorInterlockList", [])[0].get("enabled", False)
            color = "green" if status else "red"
            label.configure(text=f"{status}", fg_color=color)  # Atualiza a label com cor de fundo
            log_message(f"Get_Interlock = {status}")
        else:
            label.configure(text=f"Erro: {response.status_code}", fg_color="gray")
    except requests.exceptions.RequestException as e:
        label.configure(text=f"Erro: {e}", fg_color="gray")

# Função para traduzir status magnético
def interpretar_magnetic_status(codigo: int) -> str:
    magnetic_status_map = {
        0: "Fechada (magneticamente fechada)",
        1: "Aberta (magneticamente aberta)",
        2: "Alarme de curto-circuito",
        3: "Alarme de circuito aberto",
        4: "Alarme de exceção"
    }
    return magnetic_status_map.get(codigo, "Desconhecido")


def get_magnetic_status(label):
    global ultimo_status_magnetico
    url = f"http://{ip_address}:{port}/ISAPI/AccessControl/AcsWorkStatus?format=json"

    try:
        response = requests.get(url, auth=auth, timeout=5)
        if response.status_code == 200:
            data = response.json()
            magnetic_status_raw = data.get("AcsWorkStatus", {}).get("magneticStatus", -1)
            status_code = int(magnetic_status_raw[0]) if isinstance(magnetic_status_raw, list) else int(magnetic_status_raw)

            magnetic_status_map = {
                0: "Porta Fechada",
                1: "Porta Aberto",
                2: "Alarme de curto-circuito",
                3: "Alarme de circuito aberto",
                4: "Alarme de exceção"
            }

            descricao = magnetic_status_map.get(status_code, "Desconhecido")
            cor = "green" if status_code == 0 else "orange" if status_code == 1 else "red"

            status_atual = f"{descricao}|{cor}"

            if status_atual != ultimo_status_magnetico:
                label.configure(text=descricao, fg_color=cor)
                log_message(f"Magnetic_Status = {descricao}")
                ultimo_status_magnetico = status_atual

        else:
            status_erro = f"Erro HTTP: {response.status_code}|gray"
            if status_erro != ultimo_status_magnetico:
                label.configure(text=f"Erro HTTP: {response.status_code}", fg_color="gray")
                ultimo_status_magnetico = status_erro

    except requests.exceptions.RequestException as e:
        status_erro = f"Erro:|gray"
        if status_erro != ultimo_status_magnetico:
            label.configure(text=f"Erro:", fg_color="gray")
            ultimo_status_magnetico = status_erro

def verificar_sip_status(label):
    url = f"http://{ip_address}:{port}/ISAPI/System/Network/SIP/StandardSipParam?format=json"

    try:
        response = requests.get(url, auth=auth, timeout=5)
        if response.status_code == 200:
            data = response.json()
            sip_list = data.get("standardSipParamList", [])
            register_status = data.get("registerStatus", False)

            if sip_list:
                sip_config = sip_list[0]
                user_name = sip_config.get("registerUserName", "").strip()

                if user_name:
                    if register_status:
                        mensagem = f"SIP Registrado ({user_name})"
                        cor = "green"
                    else:
                        mensagem = f"SIP Não Registrado ({user_name})"
                        cor = "red"
                else:
                    mensagem = "SIP Não Configurado"
                    cor = "gray"
            else:
                mensagem = "Configuração SIP não encontrada"
                cor = "gray"
        else:
            mensagem = f"Erro HTTP: {response.status_code}"
            cor = "gray"

    except requests.exceptions.RequestException as e:
        mensagem = f"Erro: {e}"
        cor = "gray"

    label.configure(text=mensagem, fg_color=cor)
    log_message(f"SIP Status: {mensagem}")


##### get networking

def get_network_info(ip_address, port, auth):
    url = f'http://{ip_address}:{port}/ISAPI/System/Network/interfaces'
    print(f"Requisitando informações de rede: {url}")

    try:
        response = requests.get(url, auth=auth, timeout=5)
        print(f"Status de resposta: {response.status_code}")

        if response.status_code == 200:
            log_message("Get Network Info Sucesso.")

            # Parse do XML
            root = ET.fromstring(response.text)

            # Remover namespace (caso exista)
            for elem in root.iter():
                if '}' in elem.tag:
                    elem.tag = elem.tag.split('}', 1)[1]

            interface = root.find('NetworkInterface')
            if interface is None:
                return {"erro": "Interface de rede não encontrada"}

            ip_address = interface.find('.//ipAddress').text
            subnet_mask = interface.find('.//subnetMask').text
            gateway = interface.find('.//DefaultGateway/ipAddress').text
            dns1 = interface.find('.//PrimaryDNS/ipAddress').text
            dns2 = interface.find('.//SecondaryDNS/ipAddress').text
            mac = interface.find('.//macAddress').text
            mtu = interface.find('.//MTU').text
            speed = interface.find('.//speed').text
            duplex = interface.find('.//duplex').text

            return {
                "ip": ip_address,
                "subnet": subnet_mask,
                "gateway": gateway,
                "dns1": dns1,
                "dns2": dns2,
                "mac": mac,
                "mtu": mtu,
                "speed": speed,
                "duplex": duplex,
            }

        else:
            return {"erro": "Erro ao obter informações de rede"}
    except Exception as e:
        log_message(f"Erro na requisição de rede: {e}")
        return {"erro": "Exceção ao obter informações de rede"}
    
def preencher_info_rede():
    info = get_network_info(ip_address_var.get(), port_var.get(), auth)
    if "erro" in info:
        log_message(info["erro"])
        return

    network_ip_var.set(info.get("ip", "---"))
    network_subnet_var.set(info.get("subnet", "---"))
    network_gateway_var.set(info.get("gateway", "---"))
    network_mac_var.set(info.get("mac", "---"))
    network_dns1_var.set(info.get("dns1", "---"))
    network_dns2_var.set(info.get("dns2", "---"))
    network_speed_var.set(info.get("speed", "---"))
    network_mtu_var.set(info.get("mtu", "---"))

from requests.auth import HTTPDigestAuth

def salvar_configuracao_rede():
    ip_alvo = ip_address_var.get()
    porta = port_var.get()
    protocolo = "https" if porta == "443" else "http"
    url = f"{protocolo}://{ip_alvo}:{porta}/ISAPI/System/Network/interfaces/1"

    headers = {
        "Content-Type": "application/xml"
    }

    xml_config = f"""<?xml version="1.0" encoding="UTF-8"?>
<NetworkInterface>
    <id>1</id>
    <IPAddress>
        <ipVersion>v4</ipVersion>
        <addressingType>static</addressingType>
        <ipAddress>{network_ip_var.get()}</ipAddress>
        <subnetMask>{network_subnet_var.get()}</subnetMask>
        <DefaultGateway>
            <ipAddress>{network_gateway_var.get()}</ipAddress>
            <ipv6Address>::</ipv6Address>
        </DefaultGateway>
        <Ipv6Mode>
            <ipV6AddressingType>ra</ipV6AddressingType>
        </Ipv6Mode>
        <PrimaryDNS>
            <ipAddress>{network_dns1_var.get()}</ipAddress>
        </PrimaryDNS>
        <SecondaryDNS>
            <ipAddress>{network_dns2_var.get()}</ipAddress>
        </SecondaryDNS>
        <DNSEnable>false</DNSEnable>
    </IPAddress>
    <Link>
        <MACAddress>{network_mac_var.get()}</MACAddress>
        <autoNegotiation>true</autoNegotiation>
        <speed>{network_speed_var.get()}</speed>
        <duplex>full</duplex>
        <MTU>{network_mtu_var.get()}</MTU>
    </Link>
</NetworkInterface>"""

    try:
        auth = HTTPDigestAuth(username_var.get(), password_var.get())
        response = requests.put(url, data=xml_config, headers=headers, auth=auth, verify=False)
        if response.status_code == 200:
            log_message("✅ Configuração de rede atualizada com sucesso!")
        else:
            log_message(f"⚠️ Falha ao aplicar configuração. Código: {response.status_code}")
            log_message(f"Resposta: {response.text}")
    except Exception as e:
        log_message(f"❌ Erro ao tentar atualizar configuração: {e}")

####### activar facial



open_config_window()