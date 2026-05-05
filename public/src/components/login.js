export function renderLoginScreen() {
  return `
    <section id="loginScreen" class="min-h-screen flex items-center justify-center px-4 py-8">
      <div class="card p-6 md:p-8 w-full max-w-md">
        <div class="flex justify-center mb-4">
          <img id="loginLogoDesktop" alt="Garcia Turismo" class="logo-login max-h-28" />
        </div>

        <h1 class="text-3xl font-semibold text-slate-900 text-center">
          Garcia Turismo
        </h1>

        <p class="text-sm muted mt-2 text-center">
          Acesso ao sistema
        </p>

        <form id="loginForm" class="space-y-4 mt-6">
          <input id="loginUser" class="field" type="text" placeholder="Usuário" required />
          <input id="loginPass" class="field" type="password" placeholder="Senha" required />

          <button type="submit" class="w-full rounded-2xl px-5 py-4 btn-primary font-semibold">
            Entrar
          </button>
        </form>

        <p class="text-xs muted text-center mt-4">
          
        </p>
      </div>
    </section>
  `;
}
