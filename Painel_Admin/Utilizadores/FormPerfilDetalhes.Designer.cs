namespace Painel_Admin
{
    partial class FormPerfilDetalhes
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormPerfilDetalhes));
            this.menuStrip1 = new System.Windows.Forms.MenuStrip();
            this.produtosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.editarProdutosToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.PainelPrincipal = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilDetalhesToolStripMenuItem1 = new System.Windows.Forms.ToolStripMenuItem();
            this.perfilEditarToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.painelPerfisToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.menuStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // menuStrip1
            // 
            this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.produtosToolStripMenuItem,
            this.PainelPrincipal});
            this.menuStrip1.Location = new System.Drawing.Point(0, 0);
            this.menuStrip1.Name = "menuStrip1";
            this.menuStrip1.Size = new System.Drawing.Size(800, 24);
            this.menuStrip1.TabIndex = 2;
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
            this.editarProdutosToolStripMenuItem.Size = new System.Drawing.Size(180, 22);
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
            // FormPerfilDetalhes
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.Maroon;
            this.ClientSize = new System.Drawing.Size(800, 450);
            this.Controls.Add(this.menuStrip1);
            this.Font = new System.Drawing.Font("Segoe UI", 8.25F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "FormPerfilDetalhes";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "FormPerfilDetalhes";
            this.Load += new System.EventHandler(this.FormPerfilDetalhes_Load);
            this.menuStrip1.ResumeLayout(false);
            this.menuStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.MenuStrip menuStrip1;
        private System.Windows.Forms.ToolStripMenuItem produtosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem editarProdutosToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem PainelPrincipal;
        private System.Windows.Forms.ToolStripMenuItem perfilDetalhesToolStripMenuItem1;
        private System.Windows.Forms.ToolStripMenuItem perfilEditarToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem painelPerfisToolStripMenuItem;
    }
}