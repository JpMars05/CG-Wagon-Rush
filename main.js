import { CGFapplication } from '../lib/CGF.js';
import { MyScene } from './MyScene.js';
import { MyInterface } from './MyInterface.js';

/**
 * Função principal (ponto de entrada da aplicação).
 * Cria a aplicação CGF, instancia a cena e a interface,
 * associa-as e inicia o ciclo principal de renderização.
 */
function main() {
    // Inicialização da aplicação WebGL vinculada ao corpo do documento
    const app = new CGFapplication(document.body);

    // Instanciação da cena 3D e da interface gráfica GUI
    const myScene = new MyScene();
    const myInterface = new MyInterface();

    app.init();

    // Vinculação da cena e da interface à aplicação
    app.setScene(myScene);
    app.setInterface(myInterface);

    // Configuração inicial da câmara ativa na interface gráfica
    myInterface.setActiveCamera(myScene.camera);

    // Início do ciclo de execução contínuo
    app.run();
}

main();