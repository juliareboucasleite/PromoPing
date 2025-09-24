namespace Painel_Admin
{
    partial class FormRegistar
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormRegistar));
            this.BotaoLimpar = new System.Windows.Forms.Button();
            this.TxtSenha = new System.Windows.Forms.TextBox();
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            this.TxtNome = new System.Windows.Forms.TextBox();
            this.label1 = new System.Windows.Forms.Label();
            this.BotaoEntrar = new System.Windows.Forms.Button();
            this.menuStrip2 = new System.Windows.Forms.MenuStrip();
            this.loginToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.suporteToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.TxtEmail = new System.Windows.Forms.TextBox();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.menuStrip2.SuspendLayout();
            this.SuspendLayout();
            // 
            // BotaoLimpar
            // 
            this.BotaoLimpar.Location = new System.Drawing.Point(31, 244);
            this.BotaoLimpar.Name = "BotaoLimpar";
            this.BotaoLimpar.Size = new System.Drawing.Size(58, 23);
            this.BotaoLimpar.TabIndex = 18;
            this.BotaoLimpar.Text = "Limpar";
            this.BotaoLimpar.UseVisualStyleBackColor = true;
            this.BotaoLimpar.Click += new System.EventHandler(this.BotaoLimpar_Click);
            // 
            // TxtSenha
            // 
            this.TxtSenha.Location = new System.Drawing.Point(31, 209);
            this.TxtSenha.Name = "TxtSenha";
            this.TxtSenha.Size = new System.Drawing.Size(137, 22);
            this.TxtSenha.TabIndex = 16;
            this.TxtSenha.Text = "Senha";
            // 
            // pictureBox1
            // 
            this.pictureBox1.Image = ((System.Drawing.Image)(resources.GetObject("pictureBox1.Image")));
            this.pictureBox1.InitialImage = ((System.Drawing.Image)(resources.GetObject("pictureBox1.InitialImage")));
            this.pictureBox1.Location = new System.Drawing.Point(54, 49);
            this.pictureBox1.Name = "pictureBox1";
            this.pictureBox1.Size = new System.Drawing.Size(89, 78);
            this.pictureBox1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pictureBox1.TabIndex = 15;
            this.pictureBox1.TabStop = false;
            // 
            // TxtNome
            // 
            this.TxtNome.Location = new System.Drawing.Point(31, 156);
            this.TxtNome.Name = "TxtNome";
            this.TxtNome.Size = new System.Drawing.Size(137, 22);
            this.TxtNome.TabIndex = 14;
            this.TxtNome.Text = "Nome";
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(72, 130);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(57, 13);
            this.label1.TabIndex = 13;
            this.label1.Text = "Utilizador";
            // 
            // BotaoEntrar
            // 
            this.BotaoEntrar.Location = new System.Drawing.Point(107, 244);
            this.BotaoEntrar.Name = "BotaoEntrar";
            this.BotaoEntrar.Size = new System.Drawing.Size(61, 23);
            this.BotaoEntrar.TabIndex = 12;
            this.BotaoEntrar.Text = "Entrar";
            this.BotaoEntrar.UseVisualStyleBackColor = true;
            this.BotaoEntrar.Click += new System.EventHandler(this.BotaoEntrar_Click);
            // 
            // menuStrip2
            // 
            this.menuStrip2.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.loginToolStripMenuItem,
            this.suporteToolStripMenuItem});
            this.menuStrip2.Location = new System.Drawing.Point(0, 0);
            this.menuStrip2.Name = "menuStrip2";
            this.menuStrip2.RenderMode = System.Windows.Forms.ToolStripRenderMode.Professional;
            this.menuStrip2.Size = new System.Drawing.Size(199, 24);
            this.menuStrip2.TabIndex = 17;
            this.menuStrip2.Text = "menuStrip2";
            // 
            // loginToolStripMenuItem
            // 
            this.loginToolStripMenuItem.Name = "loginToolStripMenuItem";
            this.loginToolStripMenuItem.Size = new System.Drawing.Size(49, 20);
            this.loginToolStripMenuItem.Text = "Login";
            this.loginToolStripMenuItem.Click += new System.EventHandler(this.btnLogin);
            // 
            // suporteToolStripMenuItem
            // 
            this.suporteToolStripMenuItem.Name = "suporteToolStripMenuItem";
            this.suporteToolStripMenuItem.Size = new System.Drawing.Size(60, 20);
            this.suporteToolStripMenuItem.Text = "Suporte";
            // 
            // TxtEmail
            // 
            this.TxtEmail.Location = new System.Drawing.Point(31, 182);
            this.TxtEmail.Name = "TxtEmail";
            this.TxtEmail.Size = new System.Drawing.Size(137, 22);
            this.TxtEmail.TabIndex = 19;
            this.TxtEmail.Text = "Email";
            // 
            // FormRegistar
            // 
            this.AcceptButton = this.BotaoEntrar;
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.Maroon;
            this.ClientSize = new System.Drawing.Size(199, 293);
            this.Controls.Add(this.TxtEmail);
            this.Controls.Add(this.BotaoLimpar);
            this.Controls.Add(this.TxtSenha);
            this.Controls.Add(this.pictureBox1);
            this.Controls.Add(this.TxtNome);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.BotaoEntrar);
            this.Controls.Add(this.menuStrip2);
            this.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.HelpButton = true;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "FormRegistar";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "FormRegistar";
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.menuStrip2.ResumeLayout(false);
            this.menuStrip2.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.Button BotaoLimpar;
        private System.Windows.Forms.TextBox TxtSenha;
        private System.Windows.Forms.PictureBox pictureBox1;
        private System.Windows.Forms.TextBox TxtNome;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Button BotaoEntrar;
        private System.Windows.Forms.MenuStrip menuStrip2;
        private System.Windows.Forms.ToolStripMenuItem loginToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem suporteToolStripMenuItem;
        private System.Windows.Forms.TextBox TxtEmail;
    }
}