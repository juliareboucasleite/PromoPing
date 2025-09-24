namespace Painel_Admin
{
    partial class ProdutosListForm
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

        #region Windows Form Designer generated code

        private void InitializeComponent()
        {
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(ProdutosListForm));
            this.dgvProdutos = new System.Windows.Forms.DataGridView();
            this.menuStrip1 = new System.Windows.Forms.MenuStrip();
            this.menuProdutos = new System.Windows.Forms.ToolStripMenuItem();
            this.menuProdutosLista = new System.Windows.Forms.ToolStripMenuItem();
            this.menuUtilizadores = new System.Windows.Forms.ToolStripMenuItem();
            this.menuUtilizadoresLista = new System.Windows.Forms.ToolStripMenuItem();
            this.menuUtilizadoresEditar = new System.Windows.Forms.ToolStripMenuItem();
            this.menuUtilizadoresPerfis = new System.Windows.Forms.ToolStripMenuItem();
            this.btnAdicionarProduto = new System.Windows.Forms.Button();
            this.btnEditarProduto = new System.Windows.Forms.Button();
            this.btnRemoverProduto = new System.Windows.Forms.Button();
            this.btnAtualizarLista = new System.Windows.Forms.Button();
            this.panelBotoes = new System.Windows.Forms.Panel();
            ((System.ComponentModel.ISupportInitialize)(this.dgvProdutos)).BeginInit();
            this.menuStrip1.SuspendLayout();
            this.panelBotoes.SuspendLayout();
            this.SuspendLayout();
            // 
            // dgvProdutos
            // 
            this.dgvProdutos.AllowUserToAddRows = false;
            this.dgvProdutos.AllowUserToDeleteRows = false;
            this.dgvProdutos.AutoSizeColumnsMode = System.Windows.Forms.DataGridViewAutoSizeColumnsMode.Fill;
            this.dgvProdutos.BackgroundColor = System.Drawing.Color.White;
            this.dgvProdutos.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dgvProdutos.Dock = System.Windows.Forms.DockStyle.Fill;
            this.dgvProdutos.Location = new System.Drawing.Point(0, 24);
            this.dgvProdutos.Name = "dgvProdutos";
            this.dgvProdutos.ReadOnly = true;
            this.dgvProdutos.SelectionMode = System.Windows.Forms.DataGridViewSelectionMode.FullRowSelect;
            this.dgvProdutos.Size = new System.Drawing.Size(800, 388);
            this.dgvProdutos.TabIndex = 0;
            // 
            // menuStrip1
            // 
            this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.menuProdutos,
            this.menuUtilizadores});
            this.menuStrip1.Location = new System.Drawing.Point(0, 0);
            this.menuStrip1.Name = "menuStrip1";
            this.menuStrip1.Size = new System.Drawing.Size(800, 24);
            this.menuStrip1.TabIndex = 1;
            this.menuStrip1.Text = "menuStrip1";
            // 
            // menuProdutos
            // 
            this.menuProdutos.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.menuProdutosLista});
            this.menuProdutos.Name = "menuProdutos";
            this.menuProdutos.Size = new System.Drawing.Size(67, 20);
            this.menuProdutos.Text = "Produtos";
            // 
            // menuProdutosLista
            // 
            this.menuProdutosLista.Name = "menuProdutosLista";
            this.menuProdutosLista.Size = new System.Drawing.Size(165, 22);
            this.menuProdutosLista.Text = "Lista de Produtos";
            // 
            // menuUtilizadores
            // 
            this.menuUtilizadores.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.menuUtilizadoresLista,
            this.menuUtilizadoresEditar,
            this.menuUtilizadoresPerfis});
            this.menuUtilizadores.Name = "menuUtilizadores";
            this.menuUtilizadores.Size = new System.Drawing.Size(80, 20);
            this.menuUtilizadores.Text = "Utilizadores";
            // 
            // menuUtilizadoresLista
            // 
            this.menuUtilizadoresLista.Name = "menuUtilizadoresLista";
            this.menuUtilizadoresLista.Size = new System.Drawing.Size(104, 22);
            this.menuUtilizadoresLista.Text = "Lista";
            // 
            // menuUtilizadoresEditar
            // 
            this.menuUtilizadoresEditar.Name = "menuUtilizadoresEditar";
            this.menuUtilizadoresEditar.Size = new System.Drawing.Size(104, 22);
            this.menuUtilizadoresEditar.Text = "Editar";
            // 
            // menuUtilizadoresPerfis
            // 
            this.menuUtilizadoresPerfis.Name = "menuUtilizadoresPerfis";
            this.menuUtilizadoresPerfis.Size = new System.Drawing.Size(104, 22);
            this.menuUtilizadoresPerfis.Text = "Perfis";
            // 
            // btnAdicionarProduto
            // 
            this.btnAdicionarProduto.Location = new System.Drawing.Point(11, 6);
            this.btnAdicionarProduto.Name = "btnAdicionarProduto";
            this.btnAdicionarProduto.Size = new System.Drawing.Size(90, 27);
            this.btnAdicionarProduto.TabIndex = 0;
            this.btnAdicionarProduto.Text = "Adicionar";
            this.btnAdicionarProduto.UseVisualStyleBackColor = true;
            this.btnAdicionarProduto.Click += new System.EventHandler(this.btnAdicionar_Click);
            // 
            // btnEditarProduto
            // 
            this.btnEditarProduto.Location = new System.Drawing.Point(111, 6);
            this.btnEditarProduto.Name = "btnEditarProduto";
            this.btnEditarProduto.Size = new System.Drawing.Size(90, 27);
            this.btnEditarProduto.TabIndex = 1;
            this.btnEditarProduto.Text = "Editar";
            this.btnEditarProduto.UseVisualStyleBackColor = true;
            this.btnEditarProduto.Click += new System.EventHandler(this.btnEditar_Click);
            // 
            // btnRemoverProduto
            // 
            this.btnRemoverProduto.Location = new System.Drawing.Point(211, 6);
            this.btnRemoverProduto.Name = "btnRemoverProduto";
            this.btnRemoverProduto.Size = new System.Drawing.Size(90, 27);
            this.btnRemoverProduto.TabIndex = 2;
            this.btnRemoverProduto.Text = "Remover";
            this.btnRemoverProduto.UseVisualStyleBackColor = true;
            this.btnRemoverProduto.Click += new System.EventHandler(this.btnRemover_Click);
            // 
            // btnAtualizarLista
            // 
            this.btnAtualizarLista.Location = new System.Drawing.Point(311, 6);
            this.btnAtualizarLista.Name = "btnAtualizarLista";
            this.btnAtualizarLista.Size = new System.Drawing.Size(120, 27);
            this.btnAtualizarLista.TabIndex = 3;
            this.btnAtualizarLista.Text = "Atualizar";
            this.btnAtualizarLista.UseVisualStyleBackColor = true;
            this.btnAtualizarLista.Click += new System.EventHandler(this.btnAtualizar_Click);
            // 
            // panelBotoes
            // 
            this.panelBotoes.BackColor = System.Drawing.Color.WhiteSmoke;
            this.panelBotoes.Controls.Add(this.btnAdicionarProduto);
            this.panelBotoes.Controls.Add(this.btnEditarProduto);
            this.panelBotoes.Controls.Add(this.btnRemoverProduto);
            this.panelBotoes.Controls.Add(this.btnAtualizarLista);
            this.panelBotoes.Dock = System.Windows.Forms.DockStyle.Bottom;
            this.panelBotoes.Location = new System.Drawing.Point(0, 412);
            this.panelBotoes.Name = "panelBotoes";
            this.panelBotoes.Size = new System.Drawing.Size(800, 38);
            this.panelBotoes.TabIndex = 2;
            // 
            // ProdutosListForm
            // 
            this.ClientSize = new System.Drawing.Size(800, 450);
            this.Controls.Add(this.dgvProdutos);
            this.Controls.Add(this.panelBotoes);
            this.Controls.Add(this.menuStrip1);
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MainMenuStrip = this.menuStrip1;
            this.Name = "ProdutosListForm";
            this.Text = "Gestão de Produtos";
            this.Load += new System.EventHandler(this.EditarProdutos_Load);
            ((System.ComponentModel.ISupportInitialize)(this.dgvProdutos)).EndInit();
            this.menuStrip1.ResumeLayout(false);
            this.menuStrip1.PerformLayout();
            this.panelBotoes.ResumeLayout(false);
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.DataGridView dgvProdutos;
        private System.Windows.Forms.MenuStrip menuStrip1;
        private System.Windows.Forms.ToolStripMenuItem menuProdutos;
        private System.Windows.Forms.ToolStripMenuItem menuProdutosLista;
        private System.Windows.Forms.ToolStripMenuItem menuUtilizadores;
        private System.Windows.Forms.ToolStripMenuItem menuUtilizadoresLista;
        private System.Windows.Forms.ToolStripMenuItem menuUtilizadoresEditar;
        private System.Windows.Forms.ToolStripMenuItem menuUtilizadoresPerfis;
        private System.Windows.Forms.Button btnAdicionarProduto;
        private System.Windows.Forms.Button btnEditarProduto;
        private System.Windows.Forms.Button btnRemoverProduto;
        private System.Windows.Forms.Button btnAtualizarLista;
        private System.Windows.Forms.Panel panelBotoes;
    }
}
