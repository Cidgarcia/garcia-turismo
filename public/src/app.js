import { renderAppLayout } from "./components/app-layout.js";
import { bootstrap } from "./core/app-controller.js";

const app = document.getElementById("app");

if (!app) {
  document.body.innerHTML = "<h1>Erro: div #app não encontrada</h1>";
  throw new Error("Elemento #app não encontrado");
}

app.innerHTML = renderAppLayout();

bootstrap();
