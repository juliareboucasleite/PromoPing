/**
 * Serviço de Sincronização Discord-Website
 * Gerencia a sincronização entre contas Discord e contas do website
 */

import { pool } from '../db.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export class DiscordSyncService {
    
    /**
     * Registra ou atualiza usuário via Discord
     */
    static async registerOrUpdateDiscordUser(discordUser, email = null) {
        try {
            const { id: discordId, username, discriminator, avatar } = discordUser;
            
            // Verificar se já existe usuário com este Discord ID
            const [existingDiscord] = await pool.query(
                'SELECT * FROM usuarios WHERE discord_id = ?',
                [discordId]
            );
            
            if (existingDiscord.length > 0) {
                // Atualizar dados do Discord
                await pool.query(
                    `UPDATE usuarios SET 
                        discord_username = ?, 
                        discord_discriminator = ?, 
                        avatar_url = ?,
                        ultimo_login = NOW()
                    WHERE discord_id = ?`,
                    [username, discriminator, avatar, discordId]
                );
                
                return {
                    success: true,
                    user: existingDiscord[0],
                    isNewUser: false
                };
            }
            
            // Se email fornecido, verificar se existe conta com esse email
            if (email) {
                const [existingEmail] = await pool.query(
                    'SELECT * FROM usuarios WHERE email = ?',
                    [email]
                );
                
                if (existingEmail.length > 0) {
                    // Vincular Discord à conta existente
                    await pool.query(
                        `UPDATE usuarios SET 
                            discord_id = ?,
                            discord_username = ?,
                            discord_discriminator = ?,
                            avatar_url = ?,
                            ultimo_login = NOW()
                        WHERE email = ?`,
                        [discordId, username, discriminator, avatar, email]
                    );
                    
                    return {
                        success: true,
                        user: { ...existingEmail[0], discord_id: discordId },
                        isNewUser: false
                    };
                }
            }
            
            // Criar nova conta
            const [result] = await pool.query(
                `INSERT INTO usuarios (nome, email, discord_id, discord_username, discord_discriminator, avatar_url, criado_em, ultimo_login) 
                 VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [username, email || `${username}@discord.local`, discordId, username, discriminator, avatar]
            );
            
            // Criar configurações padrão
            await pool.query(
                'INSERT INTO configuracoes_usuario (usuario_id) VALUES (?)',
                [result.insertId]
            );
            
            const [newUser] = await pool.query(
                'SELECT * FROM usuarios WHERE id = ?',
                [result.insertId]
            );
            
            return {
                success: true,
                user: newUser[0],
                isNewUser: true
            };
            
        } catch (error) {
            console.error('Erro ao registrar/atualizar usuário Discord:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Busca usuário por Discord ID
     */
    static async getUserByDiscordId(discordId) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM usuarios WHERE discord_id = ? AND ativo = TRUE',
                [discordId]
            );
            
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('Erro ao buscar usuário por Discord ID:', error);
            return null;
        }
    }
    
    /**
     * Gera token JWT para usuário Discord
     */
    static generateDiscordToken(user) {
        return jwt.sign(
            { 
                id: user.id, 
                email: user.email,
                discord_id: user.discord_id,
                type: 'discord'
            },
            process.env.JWT_SECRET,
            { expiresIn: '7d' } // Tokens Discord duram mais tempo
        );
    }
    
    /**
     * Busca produtos do usuário
     */
    static async getUserProducts(userId) {
        try {
            const [rows] = await pool.query(
                `SELECT p.*, 
                        (SELECT preco FROM historico_precos hp 
                         WHERE hp.produto_id = p.id 
                         ORDER BY hp.data_registro DESC LIMIT 1) as ultimo_preco
                 FROM produtos p 
                 WHERE p.usuario_id = ? AND p.ativo = TRUE
                 ORDER BY p.criado_em DESC`,
                [userId]
            );
            
            return rows;
        } catch (error) {
            console.error('Erro ao buscar produtos do usuário:', error);
            return [];
        }
    }
    
    /**
     * Adiciona produto via Discord
     */
    static async addProduct(userId, productData) {
        try {
            const { nome, url, preco_alvo, loja } = productData;
            
            const [result] = await pool.query(
                `INSERT INTO produtos (usuario_id, nome, url, preco_alvo, loja, criado_em) 
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [userId, nome, url, preco_alvo || null, loja || null]
            );
            
            return {
                success: true,
                productId: result.insertId
            };
        } catch (error) {
            console.error('Erro ao adicionar produto:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Atualiza configurações do usuário
     */
    static async updateUserSettings(userId, settings) {
        try {
            const { notificacoes_discord, notificacoes_email, frequencia_verificacao } = settings;
            
            await pool.query(
                `UPDATE configuracoes_usuario SET 
                    notificacoes_discord = COALESCE(?, notificacoes_discord),
                    notificacoes_email = COALESCE(?, notificacoes_email),
                    frequencia_verificacao = COALESCE(?, frequencia_verificacao),
                    atualizado_em = NOW()
                 WHERE usuario_id = ?`,
                [notificacoes_discord, notificacoes_email, frequencia_verificacao, userId]
            );
            
            return { success: true };
        } catch (error) {
            console.error('Erro ao atualizar configurações:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * Verifica se email já está em uso
     */
    static async isEmailAvailable(email) {
        try {
            const [rows] = await pool.query(
                'SELECT id FROM usuarios WHERE email = ?',
                [email]
            );
            
            return rows.length === 0;
        } catch (error) {
            console.error('Erro ao verificar email:', error);
            return false;
        }
    }
}

export default DiscordSyncService;
