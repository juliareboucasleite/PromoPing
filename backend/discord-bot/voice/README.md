# Sistema de Voice - PromoPing Bot

Sistema de reprodução de música para o bot Discord usando `@discordjs/voice`.

## Instalação

Instale as dependências necessárias:

```bash
npm install @discordjs/voice @distube/ytdl-core ytpl
```

## Dependências Necessárias

- `@discordjs/voice` - Biblioteca oficial do Discord.js para voice
- `@distube/ytdl-core` - Para baixar áudio do YouTube
- `ytpl` - Para suporte a playlists (opcional)

## Comandos Disponíveis

### `!play <URL>`
Reproduz uma música do YouTube.
- **Exemplo:** `!play https://www.youtube.com/watch?v=dQw4w9WgXcQ`

### `!pause`
Pausa a reprodução atual.

### `!resume` ou `!continuar`
Retoma a reprodução pausada.

### `!sair` ou `!leave`
Desconecta o bot do canal de voz e limpa a fila.

### `!lista` ou `!queue`
Mostra a fila de músicas atual.

### `!remover <número>`
Remove uma música da fila pelo número.
- **Exemplo:** `!remover 3` (remove a 3ª música da fila)

## Estrutura

- `VoiceManager.js` - Gerenciador principal de conexões e filas
- Comandos em `../comandos/`:
  - `play.js` - Reproduzir música
  - `pause.js` - Pausar
  - `resume.js` - Retomar
  - `sair-voice.js` - Desconectar
  - `lista-voice.js` - Mostrar fila
  - `remover-voice.js` - Remover da fila

## Funcionalidades

- ✅ Conexão automática a canais de voz
- ✅ Fila de reprodução
- ✅ Pausar/Retomar
- ✅ Lista de músicas
- ✅ Remover músicas da fila
- ✅ Informações detalhadas (título, duração, thumbnail)
- ✅ Reprodução automática da próxima música

## Notas

- O bot precisa das permissões `Connect` e `Speak` no canal de voz
- Apenas URLs do YouTube são suportadas atualmente
- O sistema gerencia automaticamente a conexão e desconexão
