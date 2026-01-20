import requests
import smtplib
from email.mime.text import MimeText
from email.mime.multipart import MimeMultipart
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)

class NotificationManager:
    """Gerenciador de notificações"""
    
    def __init__(self, config):
        self.config = config
        self.discord_webhook = config.get('discord_webhook_url')
        self.slack_webhook = config.get('slack_webhook_url')
        self.email_config = {
            'smtp': config.get('email_smtp', 'smtp.gmail.com'),
            'port': config.get('email_port', 587),
            'user': config.get('email_user'),
            'password': config.get('email_password')
        }
    
    def send_discord_notification(self, title, message, color=0x00ff00, fields=None):
        """Envia notificação para Discord"""
        if not self.discord_webhook:
            return False
        
        try:
            embed = {
                "title": title,
                "description": message,
                "color": color,
                "timestamp": datetime.now().isoformat(),
                "footer": {
                    "text": "PromoPing Monitor"
                }
            }
            
            if fields:
                embed["fields"] = fields
            
            payload = {
                "embeds": [embed]
            }
            
            response = requests.post(self.discord_webhook, json=payload, timeout=10)
            return response.status_code == 204
            
        except Exception as e:
            logger.error(f"Erro ao enviar notificação Discord: {e}")
            return False
    
    def send_slack_notification(self, message, channel=None):
        """Envia notificação para Slack"""
        if not self.slack_webhook:
            return False
        
        try:
            payload = {
                "text": message,
                "channel": channel,
                "username": "PromoPing",
                "icon_emoji": ":chart_with_upwards_trend:"
            }
            
            response = requests.post(self.slack_webhook, json=payload, timeout=10)
            return response.status_code == 200
            
        except Exception as e:
            logger.error(f"Erro ao enviar notificação Slack: {e}")
            return False
    
    def send_email_notification(self, subject, message, to_email=None):
        """Envia notificação por email"""
        if not all([self.email_config['user'], self.email_config['password']]):
            return False
        
        try:
            msg = MimeMultipart()
            msg['From'] = self.email_config['user']
            msg['To'] = to_email or self.email_config['user']
            msg['Subject'] = subject
            
            msg.attach(MimeText(message, 'html'))
            
            server = smtplib.SMTP(self.email_config['smtp'], self.email_config['port'])
            server.starttls()
            server.login(self.email_config['user'], self.email_config['password'])
            server.send_message(msg)
            server.quit()
            
            return True
            
        except Exception as e:
            logger.error(f"Erro ao enviar email: {e}")
            return False
    
    def notify_price_target_reached(self, product_id, product_name, current_price, target_price, store):
        """Notifica quando meta de preço é atingida"""
        title = " Meta de Preço Atingida!"
        message = f"O produto **{product_name}** atingiu sua meta de preço!"
        
        fields = [
            {"name": "Produto", "value": product_name, "inline": True},
            {"name": "Loja", "value": store, "inline": True},
            {"name": "Preço Atual", "value": f"€{current_price}", "inline": True},
            {"name": "Preço Alvo", "value": f"€{target_price}", "inline": True},
            {"name": "Economia", "value": f"€{target_price - current_price:.2f}", "inline": True},
            {"name": "ID do Produto", "value": str(product_id), "inline": True}
        ]
        
        # Discord
        self.send_discord_notification(title, message, 0x00ff00, fields)
        
        # Slack
        slack_message = f"{title}\n{message}\nLoja: {store}\nPreço: €{current_price} (Meta: €{target_price})"
        self.send_slack_notification(slack_message)
        
        # Email
        email_subject = f"PromoPing - Meta Atingida: {product_name}"
        email_message = f"""
        <h2>{title}</h2>
        <p>{message}</p>
        <table border="1" style="border-collapse: collapse;">
            <tr><td><strong>Produto:</strong></td><td>{product_name}</td></tr>
            <tr><td><strong>Loja:</strong></td><td>{store}</td></tr>
            <tr><td><strong>Preço Atual:</strong></td><td>€{current_price}</td></tr>
            <tr><td><strong>Preço Alvo:</strong></td><td>€{target_price}</td></tr>
            <tr><td><strong>Economia:</strong></td><td>€{target_price - current_price:.2f}</td></tr>
        </table>
        """
        self.send_email_notification(email_subject, email_message)
    
    def notify_system_status(self, status, message):
        """Notifica status do sistema"""
        color = 0x00ff00 if status == "OK" else 0xff0000
        emoji = "" if status == "OK" else ""
        
        title = f"{emoji} Status do Sistema: {status}"
        
        # Discord
        self.send_discord_notification(title, message, color)
        
        # Slack
        slack_message = f"{title}\n{message}"
        self.send_slack_notification(slack_message)
    
    def notify_error(self, error_message, product_id=None):
        """Notifica erros do sistema"""
        title = " Erro no Sistema PromoPing"
        message = f"Erro detectado: {error_message}"
        
        fields = []
        if product_id:
            fields.append({"name": "Produto ID", "value": str(product_id), "inline": True})
        
        fields.append({"name": "Timestamp", "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "inline": True})
        
        # Discord
        self.send_discord_notification(title, message, 0xff0000, fields)
        
        # Slack
        slack_message = f"{title}\n{message}"
        self.send_slack_notification(slack_message)
    
    def notify_daily_summary(self, stats):
        """Envia resumo diário"""
        title = " Resumo Diário - PromoPing"
        
        message = f"""
        **Estatísticas do Dia:**
        • Total de produtos monitorizados: {stats.get('total_products', 0)}
        • Preços atualizados: {stats.get('updated_prices', 0)}
        • Metas atingidas: {stats.get('targets_reached', 0)}
        • Erros: {stats.get('errors', 0)}
        • Taxa de sucesso: {stats.get('success_rate', 0):.1f}%
        """
        
        # Discord
        self.send_discord_notification(title, message, 0x0099ff)
        
        # Slack
        self.send_slack_notification(f"{title}\n{message}")

# Exemplo de uso
if __name__ == "__main__":
    # Configuração de exemplo
    config = {
        'discord_webhook_url': 'https://discord.com/api/webhooks/...',
        'slack_webhook_url': 'https://hooks.slack.com/services/...',
        'email_smtp': 'smtp.gmail.com',
        'email_port': 587,
        'email_user': 'seu@email.com',
        'email_password': 'sua_senha'
    }
    
    notifier = NotificationManager(config)
    
    # Teste de notificação
    notifier.notify_price_target_reached(
        product_id=123,
        product_name="iPhone 15",
        current_price=899.99,
        target_price=1000.00,
        store="Amazon"
    )
