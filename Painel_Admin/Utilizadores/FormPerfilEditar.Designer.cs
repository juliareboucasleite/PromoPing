namespace Painel_Admin
{
    partial class FormPerfilEditar
    {
        private System.ComponentModel.IContainer components = null;

        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Código gerado pelo Windows Form Designer

        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormPerfilEditar));
            this.txtNome = new System.Windows.Forms.TextBox();
            this.txtEmail = new System.Windows.Forms.TextBox();
            this.txtTelefone = new System.Windows.Forms.TextBox();
            this.txtPlano = new System.Windows.Forms.TextBox();
            this.txtLimiteProdutos = new System.Windows.Forms.TextBox();
            this.btnSalvar = new System.Windows.Forms.Button();
            this.btnCancelar = new System.Windows.Forms.Button();
            this.txtSenha = new System.Windows.Forms.TextBox();
            this.pictureBox1 = new System.Windows.Forms.PictureBox();
            this.label1 = new System.Windows.Forms.Label();
            this.lblNome = new System.Windows.Forms.Label();
            this.lblEmail = new System.Windows.Forms.Label();
            this.lblTelefone = new System.Windows.Forms.Label();
            this.lblPlano = new System.Windows.Forms.Label();
            this.lblLimite = new System.Windows.Forms.Label();
            this.menuStrip1 = new System.Windows.Forms.MenuStrip();
            this.produtosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.editarProdutosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.PainelPrincipal = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilDetalhesToolStripMenuItem1 = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilEditarToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.painelPerfisToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).BeginInit();
            this.menuStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // txtNome
            // 
            this.txtNome.Location = new System.Drawing.Point(136, 45);
            this.txtNome.Name = "txtNome";
            this.txtNome.Size = new System.Drawing.Size(250, 22);
            this.txtNome.TabIndex = 2;
            // 
            // txtEmail
            // 
            this.txtEmail.Location = new System.Drawing.Point(136, 85);
            this.txtEmail.Name = "txtEmail";
            this.txtEmail.Size = new System.Drawing.Size(250, 22);
            this.txtEmail.TabIndex = 4;
            // 
            // txtTelefone
            // 
            this.txtTelefone.Location = new System.Drawing.Point(136, 162);
            this.txtTelefone.Name = "txtTelefone";
            this.txtTelefone.Size = new System.Drawing.Size(250, 22);
            this.txtTelefone.TabIndex = 8;
            // 
            // txtPlano
            // 
            this.txtPlano.Location = new System.Drawing.Point(136, 202);
            this.txtPlano.Name = "txtPlano";
            this.txtPlano.Size = new System.Drawing.Size(250, 22);
            this.txtPlano.TabIndex = 10;
            // 
            // txtLimiteProdutos
            // 
            this.txtLimiteProdutos.Location = new System.Drawing.Point(136, 242);
            this.txtLimiteProdutos.Name = "txtLimiteProdutos";
            this.txtLimiteProdutos.Size = new System.Drawing.Size(250, 22);
            this.txtLimiteProdutos.TabIndex = 12;
            // 
            // btnSalvar
            // 
            this.btnSalvar.Location = new System.Drawing.Point(135, 280);
            this.btnSalvar.Name = "btnSalvar";
            this.btnSalvar.Size = new System.Drawing.Size(90, 30);
            this.btnSalvar.TabIndex = 13;
            this.btnSalvar.Text = "&Salvar";
            this.btnSalvar.UseVisualStyleBackColor = true;
            this.btnSalvar.Click += new System.EventHandler(this.btnSalvar_Click);
            // 
            // btnCancelar
            // 
            this.btnCancelar.DialogResult = System.Windows.Forms.DialogResult.Cancel;
            this.btnCancelar.Location = new System.Drawing.Point(231, 280);
            this.btnCancelar.Name = "btnCancelar";
            this.btnCancelar.Size = new System.Drawing.Size(90, 30);
            this.btnCancelar.TabIndex = 0;
            this.btnCancelar.Text = "&Cancelar";
            this.btnCancelar.UseVisualStyleBackColor = true;
            // 
            // txtSenha
            // 
            this.txtSenha.Location = new System.Drawing.Point(136, 125);
            this.txtSenha.Name = "txtSenha";
            this.txtSenha.Size = new System.Drawing.Size(250, 22);
            this.txtSenha.TabIndex = 6;
            this.txtSenha.TextChanged += new System.EventHandler(this.textBox1_TextChanged);
            // 
            // pictureBox1
            // 
            this.pictureBox1.BackColor = System.Drawing.Color.Maroon;
            this.pictureBox1.Location = new System.Drawing.Point(12, 42);
            this.pictureBox1.Name = "pictureBox1";
            this.pictureBox1.Size = new System.Drawing.Size(117, 270);
            this.pictureBox1.SizeMode = System.Windows.Forms.PictureBoxSizeMode.StretchImage;
            this.pictureBox1.TabIndex = 14;
            this.pictureBox1.TabStop = false;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.BackColor = System.Drawing.Color.Maroon;
            this.label1.Location = new System.Drawing.Point(25, 134);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(42, 13);
            this.label1.TabIndex = 5;
            this.label1.Text = "&Senha:";
            // 
            // lblNome
            // 
            this.lblNome.AutoSize = true;
            this.lblNome.BackColor = System.Drawing.Color.Maroon;
            this.lblNome.Location = new System.Drawing.Point(25, 54);
            this.lblNome.Name = "lblNome";
            this.lblNome.Size = new System.Drawing.Size(40, 13);
            this.lblNome.TabIndex = 1;
            this.lblNome.Text = "&Nome:";
            // 
            // lblEmail
            // 
            this.lblEmail.AutoSize = true;
            this.lblEmail.BackColor = System.Drawing.Color.Maroon;
            this.lblEmail.Location = new System.Drawing.Point(25, 94);
            this.lblEmail.Name = "lblEmail";
            this.lblEmail.Size = new System.Drawing.Size(37, 13);
            this.lblEmail.TabIndex = 3;
            this.lblEmail.Text = "&Email:";
            // 
            // lblTelefone
            // 
            this.lblTelefone.AutoSize = true;
            this.lblTelefone.BackColor = System.Drawing.Color.Maroon;
            this.lblTelefone.Location = new System.Drawing.Point(25, 171);
            this.lblTelefone.Name = "lblTelefone";
            this.lblTelefone.Size = new System.Drawing.Size(59, 13);
            this.lblTelefone.TabIndex = 7;
            this.lblTelefone.Text = "&Telemovel:";
            // 
            // lblPlano
            // 
            this.lblPlano.AutoSize = true;
            this.lblPlano.BackColor = System.Drawing.Color.Maroon;
            this.lblPlano.Location = new System.Drawing.Point(25, 211);
            this.lblPlano.Name = "lblPlano";
            this.lblPlano.Size = new System.Drawing.Size(39, 13);
            this.lblPlano.TabIndex = 9;
            this.lblPlano.Text = "&Plano:";
            // 
            // lblLimite
            // 
            this.lblLimite.AutoSize = true;
            this.lblLimite.BackColor = System.Drawing.Color.Maroon;
            this.lblLimite.Location = new System.Drawing.Point(25, 251);
            this.lblLimite.Name = "lblLimite";
            this.lblLimite.Size = new System.Drawing.Size(90, 13);
            this.lblLimite.TabIndex = 11;
            this.lblLimite.Text = "&Limite Produtos:";
            // 
            // menuStrip1
            // 
            this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.produtosToolStripMenuItem,
            this.PainelPrincipal});
            this.menuStrip1.Location = new System.Drawing.Point(0, 0);
            this.menuStrip1.Name = "menuStrip1";
            this.menuStrip1.Size = new System.Drawing.Size(413, 24);
            this.menuStrip1.TabIndex = 15;
            this.menuStrip1.Text = "menuStrip1";
            // 
            // produtosToolStripMenuItem
            // 
            this.produtosToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.editarProdutosToolStripMenuItem});
            this.produtosToolStripMenuItem.Name = "produtosToolStripMenuItem";
            this.produtosToolStripMenuItem.Size = new System.Drawing.Size(67, 20);
            this.produtosToolStripMenuItem.Text = "&Produtos";
            // 
            // editarProdutosToolStripMenuItem
            // 
            this.editarProdutosToolStripMenuItem.Name = "editarProdutosToolStripMenuItem";
            this.editarProdutosToolStripMenuItem.Size = new System.Drawing.Size(155, 22);
            this.editarProdutosToolStripMenuItem.Text = "&Editar Produtos";
            // 
            // PainelPrincipal
            // 
            this.PainelPrincipal.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.perfilDetalhesToolStripMenuItem1,
            this.perfilEditarToolStripMenuItem,
            this.painelPerfisToolStripMenuItem});
            this.PainelPrincipal.Name = "PainelPrincipal";
            this.PainelPrincipal.Size = new System.Drawing.Size(80, 20);
            this.PainelPrincipal.Text = "&Utilizadores";
            // 
            // perfilDetalhesToolStripMenuItem1
            // 
            this.perfilDetalhesToolStripMenuItem1.Name = "perfilDetalhesToolStripMenuItem1";
            this.perfilDetalhesToolStripMenuItem1.Size = new System.Drawing.Size(180, 22);
            this.perfilDetalhesToolStripMenuItem1.Text = "&Perfil Detalhes";
            // 
            // perfilEditarToolStripMenuItem
            // 
            this.perfilEditarToolStripMenuItem.Name = "perfilEditarToolStripMenuItem";
            this.perfilEditarToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.perfilEditarToolStripMenuItem.Text = "&Perfil Editar";
            // 
            // painelPerfisToolStripMenuItem
            // 
            this.painelPerfisToolStripMenuItem.Name = "painelPerfisToolStripMenuItem";
            this.painelPerfisToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.painelPerfisToolStripMenuItem.Text = "&Painel Perfis";
            // 
            // FormPerfilEditar
            // 
            this.BackColor = System.Drawing.Color.Brown;
            this.ClientSize = new System.Drawing.Size(413, 335);
            this.Controls.Add(this.menuStrip1);
            this.Controls.Add(this.label1);
            this.Controls.Add(this.lblNome);
            this.Controls.Add(this.lblEmail);
            this.Controls.Add(this.lblTelefone);
            this.Controls.Add(this.lblPlano);
            this.Controls.Add(this.lblLimite);
            this.Controls.Add(this.pictureBox1);
            this.Controls.Add(this.txtSenha);
            this.Controls.Add(this.txtNome);
            this.Controls.Add(this.txtEmail);
            this.Controls.Add(this.txtTelefone);
            this.Controls.Add(this.txtPlano);
            this.Controls.Add(this.txtLimiteProdutos);
            this.Controls.Add(this.btnSalvar);
            this.Controls.Add(this.btnCancelar);
            this.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "FormPerfilEditar";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Editar Perfil de Utilizador";
            this.Load += new System.EventHandler(this.FormPerfilEditar_Load);
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox1)).EndInit();
            this.menuStrip1.ResumeLayout(false);
            this.menuStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.TextBox txtNome;
        private System.Windows.Forms.TextBox txtEmail;
        private System.Windows.Forms.TextBox txtTelefone;
        private System.Windows.Forms.TextBox txtPlano;
        private System.Windows.Forms.TextBox txtLimiteProdutos;

        private System.Windows.Forms.Button btnSalvar;
        private System.Windows.Forms.Button btnCancelar;
        private System.Windows.Forms.TextBox txtSenha;
        private System.Windows.Forms.PictureBox pictureBox1;
        private System.Windows.Forms.Label label1;
        private System.Windows.Forms.Label lblNome;
        private System.Windows.Forms.Label lblEmail;
        private System.Windows.Forms.Label lblTelefone;
        private System.Windows.Forms.Label lblPlano;
        private System.Windows.Forms.Label lblLimite;
        private System.Windows.Forms.MenuStrip menuStrip1;
        private System.Windows.Forms.ToolStripMenuItem produtosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem editarProdutosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem PainelPrincipal;
        private System.Windows.Forms.ToolStripMenuItem perfilDetalhesToolStripMenuItem1;
        private System.Windows.Forms.ToolStripMenuItem perfilEditarToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem painelPerfisToolStripMenuItem;
    }
}
