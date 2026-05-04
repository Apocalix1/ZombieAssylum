#include <iostream>
#include <string>
#include <vector>
#include <ctime>
#include <cstdlib>
#include "personaggi.h"
#include "magazzino.h"

// Prototipi delle funzioni (Promesse al compilatore)
void menuCombattimento(Personaggio& p);
void eseguiEsplorazione(Magazzino& mag);
int roll(int facce);

int main() {
    std::srand(std::time(0)); 

    // Inizializzazione gioco
    Magazzino base(10.0f, 5.0f, 0, 0, 0); 
    Personaggio p1("Marcus");

    int scelta = 0;
    while (scelta != 9) {
        std::cout << "\n===============================" << std::endl;
        std::cout << "   ZOMBIE ASYLUM GESTIONALE" << std::endl;
        std::cout << "===============================" << std::endl;
        std::cout << "Stato attuale: " << (p1.inSpedizione ? "[IN SPEDIZIONE]" : "[IN BASE]") << std::endl;
        std::cout << "-------------------------------" << std::endl;
        std::cout << "1. Esplora Nuova Zona (Loot)" << std::endl;
        std::cout << "2. Mostra Scheda Personaggio" << std::endl;
        std::cout << "3. Mostra Magazzino" << std::endl;
        std::cout << "4. Sfamazione / Dissetamento" << std::endl;
        std::cout << "5. Cambia Stato (Base / Spedizione)" << std::endl;
        std::cout << "6. Registra Colpi Battaglia (GPA)" << std::endl;
        std::cout << "7. Registra Fine Battaglia (Level Up PF)" << std::endl;
        std::cout << "8. Allenamento Armi (Solo in Base)" << std::endl;
        std::cout << "9. Esci dal gioco" << std::endl;
        std::cout << "-------------------------------" << std::endl;
        std::cout << "Scelta: ";
        std::cin >> scelta;

        switch (scelta) {
            case 1:
                eseguiEsplorazione(base);
                break;
            case 2:
                p1.mostraScheda();
                break;
            case 3:
                base.mostraStato();
                std::cout << "Med-Kit -> Base: " << base.medKit.base 
                          << " | Avanzati: " << base.medKit.avanzati 
                          << " | Critici: " << base.medKit.critici << std::endl;
                break;
            case 4: {
                float q;
                std::cout << "Quanto cibo/acqua vuoi usare? (0.25, 0.5, 0.75, 1.0+): ";
                std::cin >> q;
                // Esempio: sfama. Puoi aggiungere una scelta tra cibo e acqua qui.
                base.sfama(p1, q);
                break;
            }
            case 5:
                p1.inSpedizione = !p1.inSpedizione;
                std::cout << "\n>>> " << p1.nome << (p1.inSpedizione ? " e' uscito in SPEDIZIONE!" : " e' tornato alla BASE.") << std::endl;
                break;
            case 6:
                menuCombattimento(p1);
                break;
            case 7:
                if (p1.inSpedizione) {
                    p1.registraBattaglia();
                } else {
                    std::cout << "\n[!] Devi essere in spedizione per registrare una battaglia vinta." << std::endl;
                }
                break;
            case 8:
                if (!p1.inSpedizione) {
                    std::string arma;
                    int ore;
                    std::cout << "Quale arma vuoi allenare? "; std::cin >> arma;
                    std::cout << "Quante ore? "; std::cin >> ore;
                    p1.allenamentoArma(arma, ore);
                } else {
                    std::cout << "\n[!] Torna alla base per allenarti con calma." << std::endl;
                }
                break;    
            case 9:
                std::cout << "Uscita in corso..." << std::endl;
                break;
            default:
                std::cout << "Opzione non valida." << std::endl;
        }
    }
    return 0;
}

// --- DEFINIZIONI DELLE FUNZIONI ---

void menuCombattimento(Personaggio& p) {
    if (!p.inSpedizione) {
        std::cout << "\n[!] Non puoi registrare punti GPA se non sei in spedizione!" << std::endl;
        return;
    }

    // Creiamo una lista (vector) per numerare le armi disponibili nella mappa
    std::vector<std::string> listaArmi;
    for (auto const& [nomeArma, prog] : p.competenzeArmi) {
        listaArmi.push_back(nomeArma);
    }

    if (listaArmi.empty()) {
        std::cout << "[!] Il personaggio non ha armi conosciute!" << std::endl;
        return;
    }

    std::cout << "\n--- REGISTRAZIONE COLPI (GPA) ---" << std::endl;
    for (int i = 0; i < listaArmi.size(); ++i) {
        std::cout << i + 1 << ". " << listaArmi[i] << " (Liv. " << p.competenzeArmi[listaArmi[i]].livello << ")" << std::endl;
    }
    
    std::cout << "Seleziona il numero dell'arma: ";
    int indice;
    std::cin >> indice;

    if (indice < 1 || indice > listaArmi.size()) {
        std::cout << "Scelta non valida." << std::endl;
        return;
    }

    std::string armaScelta = listaArmi[indice - 1];

    std::cout << "Esito per " << armaScelta << ":\n";
    std::cout << "1. Mancato (+0.2)\n2. Segno (+1.0)\n3. Critico (+2.0)\nScelta: ";
    int esito;
    std::cin >> esito;

    float pti = 0.0f;
    if (esito == 1) pti = 0.2f;
    else if (esito == 2) pti = 1.0f;
    else if (esito == 3) pti = 2.0f;
    else { std::cout << "Esito non valido."; return; }

    p.aggiungiPCA(armaScelta, pti);
    std::cout << ">>> Punti registrati su " << armaScelta << "!" << std::endl;
}

int roll(int facce) {
    if (facce <= 0) return 0;
    return (std::rand() % facce) + 1;
}

void eseguiEsplorazione(Magazzino& mag) {
    std::cout << "\n--- ESPLORAZIONE IN CORSO ---" << std::endl;
    // (Qui tieni il codice del loot che abbiamo scritto sopra)
    int tiro = roll(20);
    mag.aggiungiRisorse("ingranaggi", (tiro / 2.0f)); // Esempio rapido
    std::cout << "Hai trovato risorse! Controlla il magazzino." << std::endl;
}