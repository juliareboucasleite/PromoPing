const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus,
    VoiceConnectionStatus,
    getVoiceConnection
} = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');

/**
 * Gerenciador de Voice para o bot Discord
 * Gerencia conexões de voz, filas de reprodução e controle de áudio
 */
class VoiceManager {
    constructor() {
        // Mapa: guildId -> { connection, player, queue, currentTrack, isPlaying, isPaused }
        this.voiceConnections = new Map();
    }

    /**
     * Conecta o bot a um canal de voz
     * @param {GuildMember} member - Membro que solicitou a conexão
     * @returns {VoiceConnection} - Conexão de voz criada
     */
    async joinChannel(member) {
        const voiceChannel = member.voice?.channel;
        
        if (!voiceChannel) {
            throw new Error('Você precisa estar em um canal de voz!');
        }

        if (!voiceChannel.joinable) {
            throw new Error('Não consigo entrar neste canal de voz!');
        }

        const guildId = member.guild.id;
        
        // Se já existe conexão, retornar
        let connection = getVoiceConnection(guildId);
        if (connection) {
            return connection;
        }

        // Criar nova conexão
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: guildId,
            adapterCreator: member.guild.voiceAdapterCreator,
        });

        // Criar player de áudio
        const player = createAudioPlayer();

        // Configurar handlers
        connection.on(VoiceConnectionStatus.Ready, () => {
            console.log(`[VOICE] Conectado ao canal de voz em ${member.guild.name}`);
        });

        connection.on(VoiceConnectionStatus.Disconnected, () => {
            console.log(`[VOICE] Desconectado do canal de voz em ${member.guild.name}`);
            this.voiceConnections.delete(guildId);
        });

        player.on(AudioPlayerStatus.Idle, () => {
            this.playNext(guildId);
        });

        player.on('error', (error) => {
            console.error(`[VOICE] Erro no player:`, error);
        });

        // Subscrever conexão ao player
        connection.subscribe(player);

        // Inicializar estrutura de dados
        this.voiceConnections.set(guildId, {
            connection,
            player,
            queue: [],
            currentTrack: null,
            isPlaying: false,
            isPaused: false
        });

        return connection;
    }

    /**
     * Adiciona uma música à fila
     * @param {GuildMember} member - Membro que solicitou
     * @param {string} url - URL da música (YouTube)
     * @returns {Promise<Object>} - Informações da música
     */
    async addToQueue(member, url) {
        const guildId = member.guild.id;
        
        // Garantir conexão
        await this.joinChannel(member);

        // Validar URL do YouTube
        if (!ytdl.validateURL(url)) {
            throw new Error('URL do YouTube inválida!');
        }

        // Obter informações do vídeo
        const info = await ytdl.getInfo(url);
        const track = {
            url: url,
            title: info.videoDetails.title,
            duration: info.videoDetails.lengthSeconds,
            thumbnail: info.videoDetails.thumbnails[0]?.url,
            requestedBy: member.user.tag
        };

        const guildData = this.voiceConnections.get(guildId);
        guildData.queue.push(track);

        // Se não está tocando, começar a tocar
        if (!guildData.isPlaying) {
            await this.playNext(guildId);
        }

        return track;
    }

    /**
     * Reproduz a próxima música da fila
     * @param {string} guildId - ID do servidor
     */
    async playNext(guildId) {
        const guildData = this.voiceConnections.get(guildId);
        
        if (!guildData) {
            return;
        }

        // Se a fila está vazia, parar
        if (guildData.queue.length === 0) {
            guildData.isPlaying = false;
            guildData.currentTrack = null;
            return;
        }

        // Obter próxima música
        const track = guildData.queue.shift();
        guildData.currentTrack = track;
        guildData.isPlaying = true;
        guildData.isPaused = false;

        try {
            // Criar stream de áudio
            const stream = ytdl(track.url, {
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1 << 25
            });

            const resource = createAudioResource(stream);
            guildData.player.play(resource);
            
            console.log(`[VOICE] Tocando: ${track.title} em ${guildId}`);
        } catch (error) {
            console.error(`[VOICE] Erro ao reproduzir música:`, error);
            // Tentar próxima música
            this.playNext(guildId);
        }
    }

    /**
     * Pausa a reprodução atual
     * @param {string} guildId - ID do servidor
     */
    pause(guildId) {
        const guildData = this.voiceConnections.get(guildId);
        
        if (!guildData || !guildData.isPlaying) {
            throw new Error('Nada está tocando no momento!');
        }

        if (guildData.isPaused) {
            throw new Error('A música já está pausada!');
        }

        guildData.player.pause();
        guildData.isPaused = true;
    }

    /**
     * Retoma a reprodução
     * @param {string} guildId - ID do servidor
     */
    resume(guildId) {
        const guildData = this.voiceConnections.get(guildId);
        
        if (!guildData || !guildData.isPlaying) {
            throw new Error('Nada está tocando no momento!');
        }

        if (!guildData.isPaused) {
            throw new Error('A música não está pausada!');
        }

        guildData.player.unpause();
        guildData.isPaused = false;
    }

    /**
     * Para a reprodução e limpa a fila
     * @param {string} guildId - ID do servidor
     */
    stop(guildId) {
        const guildData = this.voiceConnections.get(guildId);
        
        if (!guildData) {
            throw new Error('Bot não está conectado a nenhum canal de voz!');
        }

        guildData.player.stop();
        guildData.queue = [];
        guildData.currentTrack = null;
        guildData.isPlaying = false;
        guildData.isPaused = false;
    }

    /**
     * Desconecta o bot do canal de voz
     * @param {string} guildId - ID do servidor
     */
    async leave(guildId) {
        const guildData = this.voiceConnections.get(guildId);
        
        if (!guildData) {
            throw new Error('Bot não está conectado a nenhum canal de voz!');
        }

        this.stop(guildId);
        
        if (guildData.connection) {
            guildData.connection.destroy();
        }

        this.voiceConnections.delete(guildId);
    }

    /**
     * Remove uma música da fila
     * @param {string} guildId - ID do servidor
     * @param {number} index - Índice da música (1-based)
     * @returns {Object} - Música removida
     */
    removeFromQueue(guildId, index) {
        const guildData = this.voiceConnections.get(guildId);
        
        if (!guildData) {
            throw new Error('Bot não está conectado a nenhum canal de voz!');
        }

        if (index < 1 || index > guildData.queue.length) {
            throw new Error(`Índice inválido! Use um número entre 1 e ${guildData.queue.length}`);
        }

        const removed = guildData.queue.splice(index - 1, 1)[0];
        return removed;
    }

    /**
     * Obtém a fila atual
     * @param {string} guildId - ID do servidor
     * @returns {Object} - Informações da fila
     */
    getQueue(guildId) {
        const guildData = this.voiceConnections.get(guildId);
        
        if (!guildData) {
            return null;
        }

        return {
            current: guildData.currentTrack,
            queue: guildData.queue,
            isPlaying: guildData.isPlaying,
            isPaused: guildData.isPaused
        };
    }

    /**
     * Verifica se o bot está conectado
     * @param {string} guildId - ID do servidor
     * @returns {boolean}
     */
    isConnected(guildId) {
        return this.voiceConnections.has(guildId);
    }
}

module.exports = new VoiceManager();
