namespace Painel_Admin
{
    partial class PainelPerfis
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
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle1 = new System.Windows.Forms.DataGridViewCellStyle();
            System.Windows.Forms.DataGridViewCellStyle dataGridViewCellStyle2 = new System.Windows.Forms.DataGridViewCellStyle();
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(PainelPerfis));
            this.dgvPerfis = new System.Windows.Forms.DataGridView();
            this.btnAdicionar = new System.Windows.Forms.Button();
            this.btnEditar = new System.Windows.Forms.Button();
            this.btnRemover = new System.Windows.Forms.Button();
            this.btnAtualizar = new System.Windows.Forms.Button();
            this.panelBotoes = new System.Windows.Forms.Panel();
            this.menuStrip1 = new System.Windows.Forms.MenuStrip();
            this.produtosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.editarProdutosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.PainelPrincipal = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilDetalhesToolStripMenuItem1 = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilEditarToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.painelPerfisToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.listarProdutosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.editarNotificacoesToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.editarNotificaçõesToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.notificaçõesToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            ((System.ComponentModel.ISupportInitialize)(this.dgvPerfis)).BeginInit();
            this.panelBotoes.SuspendLayout();
            this.menuStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // dgvPerfis
            // 
            this.dgvPerfis.AllowUserToAddRows = false;
            this.dgvPerfis.AllowUserToDeleteRows = false;
            this.dgvPerfis.AutoSizeColumnsMode = System.Windows.Forms.DataGridViewAutoSizeColumnsMode.Fill;
            this.dgvPerfis.BackgroundColor = System.Drawing.Color.White;
            this.dgvPerfis.BorderStyle = System.Windows.Forms.BorderStyle.None;
            dataGridViewCellStyle1.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleLeft;
            dataGridViewCellStyle1.BackColor = System.Drawing.Color.LightGray;
            dataGridViewCellStyle1.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle1.ForeColor = System.Drawing.SystemColors.WindowText;
            dataGridViewCellStyle1.SelectionBackColor = System.Drawing.SystemColors.Highlight;
            dataGridViewCellStyle1.SelectionForeColor = System.Drawing.SystemColors.HighlightText;
            dataGridViewCellStyle1.WrapMode = System.Windows.Forms.DataGridViewTriState.True;
            this.dgvPerfis.ColumnHeadersDefaultCellStyle = dataGridViewCellStyle1;
            this.dgvPerfis.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            dataGridViewCellStyle2.Alignment = System.Windows.Forms.DataGridViewContentAlignment.MiddleLeft;
            dataGridViewCellStyle2.BackColor = System.Drawing.SystemColors.Window;
            dataGridViewCellStyle2.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            dataGridViewCellStyle2.ForeColor = System.Drawing.SystemColors.ControlText;
            dataGridViewCellStyle2.SelectionBackColor = System.Drawing.Color.SteelBlue;
            dataGridViewCellStyle2.SelectionForeColor = System.Drawing.Color.White;
            dataGridViewCellStyle2.WrapMode = System.Windows.Forms.DataGridViewTriState.False;
            this.dgvPerfis.DefaultCellStyle = dataGridViewCellStyle2;
            this.dgvPerfis.Dock = System.Windows.Forms.DockStyle.Fill;
            this.dgvPerfis.EnableHeadersVisualStyles = false;
            this.dgvPerfis.Location = new System.Drawing.Point(0, 0);
            this.dgvPerfis.MultiSelect = false;
            this.dgvPerfis.Name = "dgvPerfis";
            this.dgvPerfis.ReadOnly = true;
            this.dgvPerfis.RowHeadersVisible = false;
            this.dgvPerfis.SelectionMode = System.Windows.Forms.DataGridViewSelectionMode.FullRowSelect;
            this.dgvPerfis.Size = new System.Drawing.Size(802, 412);
            this.dgvPerfis.TabIndex = 0;
            // 
            // btnAdicionar
            // 
            this.btnAdicionar.BackColor = System.Drawing.Color.ForestGreen;
            this.btnAdicionar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnAdicionar.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnAdicionar.ForeColor = System.Drawing.Color.White;
            this.btnAdicionar.Location = new System.Drawing.Point(11, 8);
            this.btnAdicionar.Name = "btnAdicionar";
            this.btnAdicionar.Size = new System.Drawing.Size(90, 27);
            this.btnAdicionar.TabIndex = 1;
            this.btnAdicionar.Text = "&Adicionar";
            this.btnAdicionar.UseVisualStyleBackColor = false;
            this.btnAdicionar.Click += new System.EventHandler(this.btnAdicionar_Click);
            // 
            // btnEditar
            // 
            this.btnEditar.BackColor = System.Drawing.Color.SteelBlue;
            this.btnEditar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnEditar.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnEditar.ForeColor = System.Drawing.Color.White;
            this.btnEditar.Location = new System.Drawing.Point(111, 8);
            this.btnEditar.Name = "btnEditar";
            this.btnEditar.Size = new System.Drawing.Size(90, 27);
            this.btnEditar.TabIndex = 2;
            this.btnEditar.Text = "&Editar";
            this.btnEditar.UseVisualStyleBackColor = false;
            this.btnEditar.Click += new System.EventHandler(this.btnEditar_Click);
            // 
            // btnRemover
            // 
            this.btnRemover.BackColor = System.Drawing.Color.Firebrick;
            this.btnRemover.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnRemover.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnRemover.ForeColor = System.Drawing.Color.White;
            this.btnRemover.Location = new System.Drawing.Point(211, 8);
            this.btnRemover.Name = "btnRemover";
            this.btnRemover.Size = new System.Drawing.Size(90, 27);
            this.btnRemover.TabIndex = 3;
            this.btnRemover.Text = "&Remover";
            this.btnRemover.UseVisualStyleBackColor = false;
            this.btnRemover.Click += new System.EventHandler(this.btnRemover_Click);
            // 
            // btnAtualizar
            // 
            this.btnAtualizar.BackColor = System.Drawing.Color.DimGray;
            this.btnAtualizar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnAtualizar.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnAtualizar.ForeColor = System.Drawing.Color.White;
            this.btnAtualizar.Location = new System.Drawing.Point(311, 8);
            this.btnAtualizar.Name = "btnAtualizar";
            this.btnAtualizar.Size = new System.Drawing.Size(120, 27);
            this.btnAtualizar.TabIndex = 0;
            this.btnAtualizar.Text = "&Atualizar";
            this.btnAtualizar.UseVisualStyleBackColor = false;
            this.btnAtualizar.Click += new System.EventHandler(this.btnAtualizar_Click);
            // 
            // panelBotoes
            // 
            this.panelBotoes.Controls.Add(this.btnAdicionar);
            this.panelBotoes.Controls.Add(this.btnEditar);
            this.panelBotoes.Controls.Add(this.btnRemover);
            this.panelBotoes.Controls.Add(this.btnAtualizar);
            this.panelBotoes.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.panelBotoes.Location = new System.Drawing.Point(0, 412);
            this.panelBotoes.Name = "panelBotoes";
            this.panelBotoes.Size = new System.Drawing.Size(802, 38);
            this.panelBotoes.TabIndex = 2;
            // 
            // menuStrip1
            // 
            this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.produtosToolStripMenuItem,
            this.PainelPrincipal,
            this.editarNotificacoesToolStripMenuItem});
            this.menuStrip1.Location = new System.Drawing.Point(0, 0);
            this.menuStrip1.Name = "menuStrip1";
            this.menuStrip1.Size = new System.Drawing.Size(802, 24);
            this.menuStrip1.TabIndex = 3;
            this.menuStrip1.Text = "menuStrip1";
            // 
            // produtosToolStripMenuItem
            // 
            this.produtosToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.editarProdutosToolStripMenuItem,
            this.listarProdutosToolStripMenuItem});
            this.produtosToolStripMenuItem.Image = ((System.Drawing.Image)(resources.GetObject("produtosToolStripMenuItem.Image")));
            this.produtosToolStripMenuItem.Name = "produtosToolStripMenuItem";
            this.produtosToolStripMenuItem.Size = new System.Drawing.Size(83, 20);
            this.produtosToolStripMenuItem.Text = "&Produtos";
            // 
            // editarProdutosToolStripMenuItem
            // 
            this.editarProdutosToolStripMenuItem.Image = ((System.Drawing.Image)(resources.GetObject("editarProdutosToolStripMenuItem.Image")));
            this.editarProdutosToolStripMenuItem.Name = "editarProdutosToolStripMenuItem";
            this.editarProdutosToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.editarProdutosToolStripMenuItem.Text = "&Editar Produtos";
            // 
            // PainelPrincipal
            // 
            this.PainelPrincipal.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.perfilDetalhesToolStripMenuItem1,
            this.perfilEditarToolStripMenuItem,
            this.painelPerfisToolStripMenuItem});
            this.PainelPrincipal.Image = ((System.Drawing.Image)(resources.GetObject("PainelPrincipal.Image")));
            this.PainelPrincipal.Name = "PainelPrincipal";
            this.PainelPrincipal.Size = new System.Drawing.Size(96, 20);
            this.PainelPrincipal.Text = "&Utilizadores";
            // 
            // perfilDetalhesToolStripMenuItem1
            // 
            this.perfilDetalhesToolStripMenuItem1.Image = global::Painel_Admin.Properties.Resources.Usuario;
            this.perfilDetalhesToolStripMenuItem1.Name = "perfilDetalhesToolStripMenuItem1";
            this.perfilDetalhesToolStripMenuItem1.Size = new System.Drawing.Size(180, 22);
            this.perfilDetalhesToolStripMenuItem1.Text = "&Perfil Detalhes";
            // 
            // perfilEditarToolStripMenuItem
            // 
            this.perfilEditarToolStripMenuItem.Image = global::Painel_Admin.Properties.Resources.Usuario;
            this.perfilEditarToolStripMenuItem.Name = "perfilEditarToolStripMenuItem";
            this.perfilEditarToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.perfilEditarToolStripMenuItem.Text = "&Perfil Editar";
            // 
            // painelPerfisToolStripMenuItem
            // 
            this.painelPerfisToolStripMenuItem.Image = global::Painel_Admin.Properties.Resources.Usuario;
            this.painelPerfisToolStripMenuItem.Name = "painelPerfisToolStripMenuItem";
            this.painelPerfisToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.painelPerfisToolStripMenuItem.Text = "&Painel Perfis";
            // 
            // listarProdutosToolStripMenuItem
            // 
            this.listarProdutosToolStripMenuItem.Image = global::Painel_Admin.Properties.Resources.Pacote;
            this.listarProdutosToolStripMenuItem.Name = "listarProdutosToolStripMenuItem";
            this.listarProdutosToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.listarProdutosToolStripMenuItem.Text = "&Listar Produtos";
            // 
            // editarNotificacoesToolStripMenuItem
            // 
            this.editarNotificacoesToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.editarNotificaçõesToolStripMenuItem,
            this.notificaçõesToolStripMenuItem});
            this.editarNotificacoesToolStripMenuItem.Image = global::Painel_Admin.Properties.Resources.Notificacoes;
            this.editarNotificacoesToolStripMenuItem.Name = "editarNotificacoesToolStripMenuItem";
            this.editarNotificacoesToolStripMenuItem.Size = new System.Drawing.Size(101, 20);
            this.editarNotificacoesToolStripMenuItem.Text = "&Notificações";
            // 
            // editarNotificaçõesToolStripMenuItem
            // 
            this.editarNotificaçõesToolStripMenuItem.Image = global::Painel_Admin.Properties.Resources.Notificacoes;
            this.editarNotificaçõesToolStripMenuItem.Name = "editarNotificaçõesToolStripMenuItem";
            this.editarNotificaçõesToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.editarNotificaçõesToolStripMenuItem.Text = "&Editar Notificações";
            // 
            // notificaçõesToolStripMenuItem
            // 
            this.notificaçõesToolStripMenuItem.Image = global::Painel_Admin.Properties.Resources.Notificacoes;
            this.notificaçõesToolStripMenuItem.Name = "notificaçõesToolStripMenuItem";
            this.notificaçõesToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
            this.notificaçõesToolStripMenuItem.Text = "Notificações";
            // 
            // PainelPerfis
            // 
            this.ClientSize = new System.Drawing.Size(802, 450);
            this.Controls.Add(this.menuStrip1);
            this.Controls.Add(this.dgvPerfis);
            this.Controls.Add(this.panelBotoes);
            this.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "PainelPerfis";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Gestão de Perfis de Utilizador";
            this.Load += new System.EventHandler(this.PainelPerfis_Load);
            ((System.ComponentModel.ISupportInitialize)(this.dgvPerfis)).EndInit();
            this.panelBotoes.ResumeLayout(false);
            this.menuStrip1.ResumeLayout(false);
            this.menuStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.DataGridView dgvPerfis;
        private System.Windows.Forms.Button btnAdicionar;
        private System.Windows.Forms.Button btnEditar;
        private System.Windows.Forms.Button btnRemover;
        private System.Windows.Forms.Button btnAtualizar;
        private System.Windows.Forms.Panel panelBotoes;
        private System.Windows.Forms.MenuStrip menuStrip1;
        private System.Windows.Forms.ToolStripMenuItem produtosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem editarProdutosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem PainelPrincipal;
        private System.Windows.Forms.ToolStripMenuItem perfilDetalhesToolStripMenuItem1;
        private System.Windows.Forms.ToolStripMenuItem perfilEditarToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem painelPerfisToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem listarProdutosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem editarNotificacoesToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem editarNotificaçõesToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem notificaçõesToolStripMenuItem;
    }
}
