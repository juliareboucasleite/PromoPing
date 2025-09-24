namespace Painel_Admin
{
    partial class Painel
    {
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Limpar os recursos que estão sendo usados.
        /// </summary>
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(Painel));
            this.dgvUtilizadores = new System.Windows.Forms.DataGridView();
            this.dgvProdutos = new System.Windows.Forms.DataGridView();
            this.menuStrip1 = new System.Windows.Forms.MenuStrip();
            this.produtosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.editarProdutosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.PainelPrincipal = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilDetalhesToolStripMenuItem1 = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilEditarToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.painelPerfisToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            ((System.ComponentModel.ISupportInitialize)(this.dgvUtilizadores)).BeginInit();
            ((System.ComponentModel.ISupportInitialize)(this.dgvProdutos)).BeginInit();
            this.menuStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // dgvUtilizadores
            // 
            this.dgvUtilizadores.AllowUserToOrderColumns = true;
            this.dgvUtilizadores.BackgroundColor = System.Drawing.Color.Maroon;
            this.dgvUtilizadores.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            this.dgvUtilizadores.GridColor = System.Drawing.Color.Black;
            resources.ApplyResources(this.dgvUtilizadores, "dgvUtilizadores");
            this.dgvUtilizadores.Name = "dgvUtilizadores";
            // 
            // dgvProdutos
            // 
            this.dgvProdutos.ColumnHeadersHeightSizeMode = System.Windows.Forms.DataGridViewColumnHeadersHeightSizeMode.AutoSize;
            resources.ApplyResources(this.dgvProdutos, "dgvProdutos");
            this.dgvProdutos.Name = "dgvProdutos";
            // 
            // menuStrip1
            // 
            this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.produtosToolStripMenuItem,
            this.PainelPrincipal});
            resources.ApplyResources(this.menuStrip1, "menuStrip1");
            this.menuStrip1.Name = "menuStrip1";
            // 
            // produtosToolStripMenuItem
            // 
            this.produtosToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.editarProdutosToolStripMenuItem});
            this.produtosToolStripMenuItem.Name = "produtosToolStripMenuItem";
            resources.ApplyResources(this.produtosToolStripMenuItem, "produtosToolStripMenuItem");
            // 
            // editarProdutosToolStripMenuItem
            // 
            this.editarProdutosToolStripMenuItem.Name = "editarProdutosToolStripMenuItem";
            resources.ApplyResources(this.editarProdutosToolStripMenuItem, "editarProdutosToolStripMenuItem");
            this.editarProdutosToolStripMenuItem.Click += new System.EventHandler(this.editarProdutosToolStripMenuItem_Click);
            // 
            // PainelPrincipal
            // 
            this.PainelPrincipal.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.perfilDetalhesToolStripMenuItem1,
            this.perfilEditarToolStripMenuItem,
            this.painelPerfisToolStripMenuItem});
            this.PainelPrincipal.Name = "PainelPrincipal";
            resources.ApplyResources(this.PainelPrincipal, "PainelPrincipal");
            // 
            // perfilDetalhesToolStripMenuItem1
            // 
            this.perfilDetalhesToolStripMenuItem1.Name = "perfilDetalhesToolStripMenuItem1";
            resources.ApplyResources(this.perfilDetalhesToolStripMenuItem1, "perfilDetalhesToolStripMenuItem1");
            this.perfilDetalhesToolStripMenuItem1.Click += new System.EventHandler(this.perfilDetalhesToolStripMenuItem_Click);
            // 
            // perfilEditarToolStripMenuItem
            // 
            this.perfilEditarToolStripMenuItem.Name = "perfilEditarToolStripMenuItem";
            resources.ApplyResources(this.perfilEditarToolStripMenuItem, "perfilEditarToolStripMenuItem");
            this.perfilEditarToolStripMenuItem.Click += new System.EventHandler(this.perfilEditarToolStripMenuItem_Click);
            // 
            // painelPerfisToolStripMenuItem
            // 
            this.painelPerfisToolStripMenuItem.Name = "painelPerfisToolStripMenuItem";
            resources.ApplyResources(this.painelPerfisToolStripMenuItem, "painelPerfisToolStripMenuItem");
            this.painelPerfisToolStripMenuItem.Click += new System.EventHandler(this.painelPerfisToolStripMenuItem_Click);
            // 
            // Painel
            // 
            resources.ApplyResources(this, "$this");
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.White;
            this.Controls.Add(this.menuStrip1);
            this.Controls.Add(this.dgvUtilizadores);
            this.Controls.Add(this.dgvProdutos);
            this.ForeColor = System.Drawing.Color.Black;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "Painel";
            this.Load += new System.EventHandler(this.Painel_Load);
            ((System.ComponentModel.ISupportInitialize)(this.dgvUtilizadores)).EndInit();
            ((System.ComponentModel.ISupportInitialize)(this.dgvProdutos)).EndInit();
            this.menuStrip1.ResumeLayout(false);
            this.menuStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion
        private System.Windows.Forms.DataGridView dgvUtilizadores;
        private System.Windows.Forms.DataGridView dgvProdutos;
        private System.Windows.Forms.MenuStrip menuStrip1;
        private System.Windows.Forms.ToolStripMenuItem produtosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem editarProdutosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem PainelPrincipal;
        private System.Windows.Forms.ToolStripMenuItem perfilDetalhesToolStripMenuItem1;
        private System.Windows.Forms.ToolStripMenuItem perfilEditarToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem painelPerfisToolStripMenuItem;
    }
}
