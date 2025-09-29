using Painel_Admin.Repositories;
using System;
using System.Data;
using System.Drawing;
using System.Windows.Forms;

namespace Painel_Admin
{
    public partial class ProdutosListForm : Form
    {
        private readonly ProdutoRepository _produtoRepo;

        public ProdutosListForm()
        {
            InitializeComponent();
            this.BackColor = Color.White; // fundo limpo
            _produtoRepo = new ProdutoRepository();
            CarregarProdutos();
        }

        private void EditarProdutos_Load(object sender, EventArgs e)
        {
            CarregarProdutos();
        }

        private void CarregarProdutos()
        {
            try
            {
                dgvProdutos.DataSource = _produtoRepo.GetAll();
                dgvProdutos.Refresh(); // ⚠️ força atualização visual
            }
            catch (Exception ex)
            {
                MessageBox.Show("Erro ao carregar produtos: " + ex.Message);
            }
        }

        private void btnAdicionar_Click(object sender, EventArgs e)
        {
            using (FormProdutoEditar form = new FormProdutoEditar()) // modal
            {
                if (form.ShowDialog() == DialogResult.OK)
                {
                    CarregarProdutos();
                }
            }
        }

        private void btnEditar_Click(object sender, EventArgs e)
        {
            if (dgvProdutos.CurrentRow != null)
            {
                int id = Convert.ToInt32(dgvProdutos.CurrentRow.Cells["Id"].Value);
                string nome = dgvProdutos.CurrentRow.Cells["Nome"].Value.ToString();
                string link = dgvProdutos.CurrentRow.Cells["Link"].Value.ToString();
                decimal precoAlvo = dgvProdutos.CurrentRow.Cells["PrecoAlvo"].Value != DBNull.Value
                    ? Convert.ToDecimal(dgvProdutos.CurrentRow.Cells["PrecoAlvo"].Value)
                    : 0;
                DateTime? dataLimite = dgvProdutos.CurrentRow.Cells["DataLimite"].Value != DBNull.Value
                    ? Convert.ToDateTime(dgvProdutos.CurrentRow.Cells["DataLimite"].Value)
                    : (DateTime?)null;
                string loja = dgvProdutos.CurrentRow.Cells["Loja"].Value.ToString();

                // ⚠️ removemos o parâmetro userId porque Update não usa mais
                using (FormProdutoEditar form = new FormProdutoEditar(id, 0, nome, link, precoAlvo, dataLimite, loja))
                {
                    if (form.ShowDialog() == DialogResult.OK)
                    {
                        CarregarProdutos();
                    }
                }
            }
        }

        private void btnRemover_Click(object sender, EventArgs e)
        {
            if (dgvProdutos.SelectedRows.Count > 0)
            {
                int id = Convert.ToInt32(dgvProdutos.SelectedRows[0].Cells["Id"].Value);

                try
                {
                    _produtoRepo.Delete(id);
                    CarregarProdutos();
                }
                catch (Exception ex)
                {
                    MessageBox.Show("Erro ao remover produto: " + ex.Message);
                }
            }
        }

        private void btnAtualizar_Click(object sender, EventArgs e)
        {
            CarregarProdutos();
        }
    }
}
