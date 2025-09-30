namespace Painel_Admin
{
    partial class FormProdutoEditar
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormProdutoEditar));
            this.lblNome = new System.Windows.Forms.Label();
            this.txtNome = new System.Windows.Forms.TextBox();
            this.lblLink = new System.Windows.Forms.Label();
            this.txtLink = new System.Windows.Forms.TextBox();
            this.lblPrecoAlvo = new System.Windows.Forms.Label();
            this.txtPrecoAlvo = new System.Windows.Forms.TextBox();
            this.lblDataLimite = new System.Windows.Forms.Label();
            this.dtpDataLimite = new System.Windows.Forms.DateTimePicker();
            this.chkSemData = new System.Windows.Forms.CheckBox();
            this.lblLoja = new System.Windows.Forms.Label();
            this.txtLoja = new System.Windows.Forms.TextBox();
            this.btnSalvar = new System.Windows.Forms.Button();
            this.btnCancelar = new System.Windows.Forms.Button();
            this.SuspendLayout();
            // 
            // lblNome
            // 
            this.lblNome.AutoSize = true;
            this.lblNome.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblNome.Location = new System.Drawing.Point(20, 20);
            this.lblNome.Name = "lblNome";
            this.lblNome.Size = new System.Drawing.Size(47, 15);
            this.lblNome.TabIndex = 0;
            this.lblNome.Text = "Nome:";
            // 
            // txtNome
            // 
            this.txtNome.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtNome.Location = new System.Drawing.Point(100, 17);
            this.txtNome.Name = "txtNome";
            this.txtNome.Size = new System.Drawing.Size(250, 23);
            this.txtNome.TabIndex = 1;
            // 
            // lblLink
            // 
            this.lblLink.AutoSize = true;
            this.lblLink.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblLink.Location = new System.Drawing.Point(20, 60);
            this.lblLink.Name = "lblLink";
            this.lblLink.Size = new System.Drawing.Size(32, 15);
            this.lblLink.TabIndex = 2;
            this.lblLink.Text = "Link:";
            // 
            // txtLink
            // 
            this.txtLink.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtLink.Location = new System.Drawing.Point(100, 57);
            this.txtLink.Name = "txtLink";
            this.txtLink.Size = new System.Drawing.Size(250, 23);
            this.txtLink.TabIndex = 3;
            // 
            // lblPrecoAlvo
            // 
            this.lblPrecoAlvo.AutoSize = true;
            this.lblPrecoAlvo.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblPrecoAlvo.Location = new System.Drawing.Point(20, 100);
            this.lblPrecoAlvo.Name = "lblPrecoAlvo";
            this.lblPrecoAlvo.Size = new System.Drawing.Size(71, 15);
            this.lblPrecoAlvo.TabIndex = 4;
            this.lblPrecoAlvo.Text = "Preço Alvo:";
            // 
            // txtPrecoAlvo
            // 
            this.txtPrecoAlvo.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtPrecoAlvo.Location = new System.Drawing.Point(100, 97);
            this.txtPrecoAlvo.Name = "txtPrecoAlvo";
            this.txtPrecoAlvo.Size = new System.Drawing.Size(100, 23);
            this.txtPrecoAlvo.TabIndex = 5;
            // 
            // lblDataLimite
            // 
            this.lblDataLimite.AutoSize = true;
            this.lblDataLimite.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblDataLimite.Location = new System.Drawing.Point(20, 140);
            this.lblDataLimite.Name = "lblDataLimite";
            this.lblDataLimite.Size = new System.Drawing.Size(70, 15);
            this.lblDataLimite.TabIndex = 6;
            this.lblDataLimite.Text = "Data Limite:";
            // 
            // dtpDataLimite
            // 
            this.dtpDataLimite.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.dtpDataLimite.Format = System.Windows.Forms.DateTimePickerFormat.Short;
            this.dtpDataLimite.Location = new System.Drawing.Point(100, 137);
            this.dtpDataLimite.Name = "dtpDataLimite";
            this.dtpDataLimite.Size = new System.Drawing.Size(120, 23);
            this.dtpDataLimite.TabIndex = 7;
            // 
            // chkSemData
            // 
            this.chkSemData.AutoSize = true;
            this.chkSemData.Font = new System.Drawing.Font("Segoe UI", 8.5F);
            this.chkSemData.Location = new System.Drawing.Point(230, 139);
            this.chkSemData.Name = "chkSemData";
            this.chkSemData.Size = new System.Drawing.Size(89, 19);
            this.chkSemData.TabIndex = 8;
            this.chkSemData.Text = "Sem limite";
            this.chkSemData.UseVisualStyleBackColor = true;
            // 
            // lblLoja
            // 
            this.lblLoja.AutoSize = true;
            this.lblLoja.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblLoja.Location = new System.Drawing.Point(20, 180);
            this.lblLoja.Name = "lblLoja";
            this.lblLoja.Size = new System.Drawing.Size(34, 15);
            this.lblLoja.TabIndex = 9;
            this.lblLoja.Text = "Loja:";
            // 
            // txtLoja
            // 
            this.txtLoja.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtLoja.Location = new System.Drawing.Point(100, 177);
            this.txtLoja.Name = "txtLoja";
            this.txtLoja.Size = new System.Drawing.Size(250, 23);
            this.txtLoja.TabIndex = 10;
            // 
            // btnSalvar
            // 
            this.btnSalvar.BackColor = System.Drawing.Color.ForestGreen;
            this.btnSalvar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnSalvar.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnSalvar.ForeColor = System.Drawing.Color.White;
            this.btnSalvar.Location = new System.Drawing.Point(100, 220);
            this.btnSalvar.Name = "btnSalvar";
            this.btnSalvar.Size = new System.Drawing.Size(100, 30);
            this.btnSalvar.TabIndex = 11;
            this.btnSalvar.Text = "💾 Salvar";
            this.btnSalvar.UseVisualStyleBackColor = false;
            this.btnSalvar.Click += new System.EventHandler(this.btnSalvar_Click);
            // 
            // btnCancelar
            // 
            this.btnCancelar.BackColor = System.Drawing.Color.Firebrick;
            this.btnCancelar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnCancelar.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnCancelar.ForeColor = System.Drawing.Color.White;
            this.btnCancelar.Location = new System.Drawing.Point(250, 220);
            this.btnCancelar.Name = "btnCancelar";
            this.btnCancelar.Size = new System.Drawing.Size(100, 30);
            this.btnCancelar.TabIndex = 12;
            this.btnCancelar.Text = "❌ Cancelar";
            this.btnCancelar.UseVisualStyleBackColor = false;
            this.btnCancelar.Click += new System.EventHandler(this.btnCancelar_Click);
            // 
            // FormProdutoEditar
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(7F, 15F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.BackColor = System.Drawing.Color.Gainsboro;
            this.ClientSize = new System.Drawing.Size(380, 280);
            this.Controls.Add(this.lblNome);
            this.Controls.Add(this.txtNome);
            this.Controls.Add(this.lblLink);
            this.Controls.Add(this.txtLink);
            this.Controls.Add(this.lblPrecoAlvo);
            this.Controls.Add(this.txtPrecoAlvo);
            this.Controls.Add(this.lblDataLimite);
            this.Controls.Add(this.dtpDataLimite);
            this.Controls.Add(this.chkSemData);
            this.Controls.Add(this.lblLoja);
            this.Controls.Add(this.txtLoja);
            this.Controls.Add(this.btnSalvar);
            this.Controls.Add(this.btnCancelar);
            this.FormBorderStyle = System.Windows.Forms.FormBorderStyle.FixedDialog;
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "FormProdutoEditar";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Gestão de Produto";
            this.Load += new System.EventHandler(this.FormProdutoEditar_Load);
            this.ResumeLayout(false);
            this.PerformLayout();
        }

        #endregion

        private System.Windows.Forms.Label lblNome;
        private System.Windows.Forms.TextBox txtNome;
        private System.Windows.Forms.Label lblLink;
        private System.Windows.Forms.TextBox txtLink;
        private System.Windows.Forms.Label lblPrecoAlvo;
        private System.Windows.Forms.TextBox txtPrecoAlvo;
        private System.Windows.Forms.Label lblDataLimite;
        private System.Windows.Forms.DateTimePicker dtpDataLimite;
        private System.Windows.Forms.CheckBox chkSemData;
        private System.Windows.Forms.Label lblLoja;
        private System.Windows.Forms.TextBox txtLoja;
        private System.Windows.Forms.Button btnSalvar;
        private System.Windows.Forms.Button btnCancelar;
    }
}
