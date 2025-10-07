namespace Painel_Admin.Produtos
{
    partial class FormProdutoAdicionar
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
            System.ComponentModel.ComponentResourceManager resources = new System.ComponentModel.ComponentResourceManager(typeof(FormProdutoAdicionar));
            this.ComboBoxID = new System.Windows.Forms.ComboBox();
            this.label1 = new System.Windows.Forms.Label();
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
            this.pictureBox2 = new System.Windows.Forms.PictureBox();
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox2)).BeginInit();
            this.SuspendLayout();
            // 
            // ComboBoxID
            // 
            this.ComboBoxID.FormattingEnabled = true;
            this.ComboBoxID.Location = new System.Drawing.Point(90, 124);
            this.ComboBoxID.Name = "ComboBoxID";
            this.ComboBoxID.Size = new System.Drawing.Size(61, 21);
            this.ComboBoxID.TabIndex = 29;
            // 
            // label1
            // 
            this.label1.AutoSize = true;
            this.label1.Location = new System.Drawing.Point(12, 133);
            this.label1.Name = "label1";
            this.label1.Size = new System.Drawing.Size(67, 13);
            this.label1.TabIndex = 28;
            this.label1.Text = "ID Utilizador:";
            // 
            // lblNome
            // 
            this.lblNome.AutoSize = true;
            this.lblNome.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblNome.Location = new System.Drawing.Point(12, 29);
            this.lblNome.Name = "lblNome";
            this.lblNome.Size = new System.Drawing.Size(43, 15);
            this.lblNome.TabIndex = 15;
            this.lblNome.Text = "Nome:";
            // 
            // txtNome
            // 
            this.txtNome.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtNome.Location = new System.Drawing.Point(90, 21);
            this.txtNome.Name = "txtNome";
            this.txtNome.Size = new System.Drawing.Size(291, 23);
            this.txtNome.TabIndex = 16;
            // 
            // lblLink
            // 
            this.lblLink.AutoSize = true;
            this.lblLink.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblLink.Location = new System.Drawing.Point(12, 64);
            this.lblLink.Name = "lblLink";
            this.lblLink.Size = new System.Drawing.Size(32, 15);
            this.lblLink.TabIndex = 17;
            this.lblLink.Text = "Link:";
            // 
            // txtLink
            // 
            this.txtLink.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtLink.Location = new System.Drawing.Point(90, 55);
            this.txtLink.Name = "txtLink";
            this.txtLink.Size = new System.Drawing.Size(291, 23);
            this.txtLink.TabIndex = 18;
            // 
            // lblPrecoAlvo
            // 
            this.lblPrecoAlvo.AutoSize = true;
            this.lblPrecoAlvo.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblPrecoAlvo.Location = new System.Drawing.Point(12, 99);
            this.lblPrecoAlvo.Name = "lblPrecoAlvo";
            this.lblPrecoAlvo.Size = new System.Drawing.Size(67, 15);
            this.lblPrecoAlvo.TabIndex = 19;
            this.lblPrecoAlvo.Text = "Preço Alvo:";
            // 
            // txtPrecoAlvo
            // 
            this.txtPrecoAlvo.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtPrecoAlvo.Location = new System.Drawing.Point(90, 90);
            this.txtPrecoAlvo.Name = "txtPrecoAlvo";
            this.txtPrecoAlvo.Size = new System.Drawing.Size(86, 23);
            this.txtPrecoAlvo.TabIndex = 20;
            // 
            // lblDataLimite
            // 
            this.lblDataLimite.AutoSize = true;
            this.lblDataLimite.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblDataLimite.Location = new System.Drawing.Point(12, 164);
            this.lblDataLimite.Name = "lblDataLimite";
            this.lblDataLimite.Size = new System.Drawing.Size(70, 15);
            this.lblDataLimite.TabIndex = 21;
            this.lblDataLimite.Text = "Data Limite:";
            // 
            // dtpDataLimite
            // 
            this.dtpDataLimite.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.dtpDataLimite.Format = System.Windows.Forms.DateTimePickerFormat.Short;
            this.dtpDataLimite.Location = new System.Drawing.Point(90, 156);
            this.dtpDataLimite.Name = "dtpDataLimite";
            this.dtpDataLimite.Size = new System.Drawing.Size(103, 23);
            this.dtpDataLimite.TabIndex = 22;
            // 
            // chkSemData
            // 
            this.chkSemData.AutoSize = true;
            this.chkSemData.Font = new System.Drawing.Font("Segoe UI", 8.5F);
            this.chkSemData.Location = new System.Drawing.Point(201, 157);
            this.chkSemData.Name = "chkSemData";
            this.chkSemData.Size = new System.Drawing.Size(82, 19);
            this.chkSemData.TabIndex = 23;
            this.chkSemData.Text = "Sem limite";
            this.chkSemData.UseVisualStyleBackColor = true;
            // 
            // lblLoja
            // 
            this.lblLoja.AutoSize = true;
            this.lblLoja.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.lblLoja.Location = new System.Drawing.Point(12, 199);
            this.lblLoja.Name = "lblLoja";
            this.lblLoja.Size = new System.Drawing.Size(32, 15);
            this.lblLoja.TabIndex = 24;
            this.lblLoja.Text = "Loja:";
            // 
            // txtLoja
            // 
            this.txtLoja.Font = new System.Drawing.Font("Segoe UI", 9F);
            this.txtLoja.Location = new System.Drawing.Point(90, 190);
            this.txtLoja.Name = "txtLoja";
            this.txtLoja.Size = new System.Drawing.Size(215, 23);
            this.txtLoja.TabIndex = 25;
            // 
            // btnSalvar
            // 
            this.btnSalvar.BackColor = System.Drawing.Color.ForestGreen;
            this.btnSalvar.FlatStyle = System.Windows.Forms.FlatStyle.Flat;
            this.btnSalvar.Font = new System.Drawing.Font("Segoe UI", 9F, System.Drawing.FontStyle.Bold);
            this.btnSalvar.ForeColor = System.Drawing.Color.White;
            this.btnSalvar.Location = new System.Drawing.Point(90, 228);
            this.btnSalvar.Name = "btnSalvar";
            this.btnSalvar.Size = new System.Drawing.Size(86, 26);
            this.btnSalvar.TabIndex = 26;
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
            this.btnCancelar.Location = new System.Drawing.Point(218, 228);
            this.btnCancelar.Name = "btnCancelar";
            this.btnCancelar.Size = new System.Drawing.Size(86, 26);
            this.btnCancelar.TabIndex = 27;
            this.btnCancelar.Text = "❌ Cancelar";
            this.btnCancelar.UseVisualStyleBackColor = false;
            this.btnCancelar.Click += new System.EventHandler(this.btnCancelar_Click);
            // 
            // pictureBox2
            // 
            this.pictureBox2.BackColor = System.Drawing.Color.Transparent;
            this.pictureBox2.Image = global::Painel_Admin.Properties.Resources.android_chrome_192x192;
            this.pictureBox2.Location = new System.Drawing.Point(450, 64);
            this.pictureBox2.Name = "pictureBox2";
            this.pictureBox2.Size = new System.Drawing.Size(150, 120);
            this.pictureBox2.SizeMode = System.Windows.Forms.PictureBoxSizeMode.Zoom;
            this.pictureBox2.TabIndex = 30;
            this.pictureBox2.TabStop = false;
            // 
            // FormProdutoAdicionar
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(627, 274);
            this.Controls.Add(this.pictureBox2);
            this.Controls.Add(this.ComboBoxID);
            this.Controls.Add(this.label1);
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
            this.Icon = ((System.Drawing.Icon)(resources.GetObject("$this.Icon")));
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.Name = "FormProdutoAdicionar";
            this.StartPosition = System.Windows.Forms.FormStartPosition.CenterScreen;
            this.Text = "Adicionar Produto";
            this.Load += new System.EventHandler(this.FormAdicionarProduto_Load);
            ((System.ComponentModel.ISupportInitialize)(this.pictureBox2)).EndInit();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.ComboBox ComboBoxID;
        private System.Windows.Forms.Label label1;
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
        private System.Windows.Forms.PictureBox pictureBox2;
    }
}