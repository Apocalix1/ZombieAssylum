/*  #include <iostream>
#include <vector>
#include <string>
#include <limits>
#include <algorithm>
#include "personaggi.h"
#include "magazzino.h"

// --- PROTOTIPI ---
void menuCreazione(std::vector<Personaggio>& party, int oreTotali);
void gestisciPersonaggi(std::vector<Personaggio>& party, Magazzino& base, int oreTotali);
void menuSpedizione(Personaggio& p);
void mostraIdentita(const Personaggio& p);
void avanzaTempoGlobale(std::vector<Personaggio>& party, int& oreTotali, int oreDaAggiungere);

// --- HELPER ---
void clearCin() {
    std::cin.clear();
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
}

int main() {
    std::vector<Personaggio> party;
    Magazzino base(10.0f, 5.0f, 0, 0, 0);
    int scelta = 0;
    int oreTotali = 0;

    while (scelta != 9) {
        int giornoCorrente = oreTotali / 24;
        int oraCorrente = oreTotali % 24;

        std::cout << "\n==============================================";
        std::cout << "\n GIORNO: " << giornoCorrente << " | ORA: " << (oraCorrente < 10 ? "0" : "") << oraCorrente << ":00";
        std::cout << "\n========== ZOMBIE ASYLUM GESTIONALE ==========\n";
        std::cout << "1. Crea Nuovo Personaggio\n";
        std::cout << "2. Controlla Magazzino\n";
        if (!party.empty()) {
            std::cout << "3. GESTISCI PERSONAGGI (" << party.size() << " attivi)\n";
        }
        std::cout << "4. AVANZA TEMPO (Ore)\n";
        std::cout << "9. Esci\n";
        std::cout << "----------------------------------------------\nScelta: ";
        
        if (!(std::cin >> scelta)) { clearCin(); continue; }

        switch (scelta) {
            case 1: menuCreazione(party, oreTotali); break;
            case 2: base.mostraStato(); break;
            case 3: if (!party.empty()) gestisciPersonaggi(party, base, oreTotali); break;
            case 4: {
                int h;
                std::cout << "Quante ore vuoi far passare? ";
                std::cin >> h;
                avanzaTempoGlobale(party, oreTotali, h);
                break;
            }
        }
    }
    return 0;
}

void avanzaTempoGlobale(std::vector<Personaggio>& party, int& oreTotali, int oreDaAggiungere) {
    if (oreDaAggiungere <= 0) return;
    oreTotali += oreDaAggiungere;
    int giornoAggiornato = oreTotali / 24;

    for (auto& p : party) {
        p.avanzaTempo(oreDaAggiungere);
        p.giorniAttivi = giornoAggiornato; // Aggiorna l'esperienza per il Bonus Competenza
    }
    std::cout << "\n[TEMPO] Sono passate " << oreDaAggiungere << " ore. Totale: Giorno " << giornoAggiornato << "\n";
}

void mostraIdentita(const Personaggio& p) {
    std::cout << "\n--- IDENTITA' ATTUALE ---\n";
    std::cout << "Nome: " << p.nome << "\n";
    std::cout << "Punti Creazione: " << p.puntiCreazione << "\n";
    std::cout << "Monete d'Argento: " << p.moneteArgento << "\n";
    std::cout << "Fobie: ";
    bool haFobie = false;
    for(const auto& perk : p.perksAttivi) {
        if(!p.perksAttivi.empty() && !perk.motivoPanico.empty()) { 
            std::cout << "[" << perk.motivoPanico << "] "; 
            haFobie = true; 
        }
    }
    if(!haFobie) std::cout << "Nessuna";
    std::cout << "\n-------------------------\n";
}

void menuCreazione(std::vector<Personaggio>& party, int oreTotali) {
    std::string nome;
    std::cout << "Inserisci il nome del sopravvissuto: ";
    clearCin();
    std::getline(std::cin, nome);
    
    Personaggio p(nome);
    p.giorniAttivi = oreTotali / 24; // Parte con l'esperienza attuale del mondo
    
    std::vector<Perk> catalogo = {
        {"Amicizia", "Aumenta CA alleato di 2.", -2, "", false},
        {"Leader nato", "+1 CAR ogni 2 alleati.", -3, "", true},
        {"Abbandono", "Panico se solo.", 3, "Solitudine", false},
        {"Paranoico", "Ossessione giornaliera.", 4, "Ansia", true}
    };

    int scelta = 0;
    while (scelta != 4) {
        mostraIdentita(p);
        std::cout << "1. Potenzia Caratteristiche\n2. Scegli Perk/Malus\n3. Fine (Salva)\nScelta: ";
        std::cin >> scelta;

        if (scelta == 1) {
            int s;
            std::cout << "Scegli (1.FOR 2.DES 3.COS 4.INT 5.SAG 6.CAR): ";
            std::cin >> s;
            if (s < 1 || s > 6) continue;
            
            std::string stats[] = {"Forza", "Destrezza", "Costituzione", "Intelligenza", "Saggezza", "Carisma"};
            p.aumentaStatistica(stats[s-1]);
        }
        else if (scelta == 2) {
            for(int i=0; i<catalogo.size(); ++i) {
                std::cout << i+1 << ". " << catalogo[i].nome << " (" << (catalogo[i].costo > 0 ? "+" : "") << catalogo[i].costo << " punti)\n";
            }
            int iP; std::cin >> iP;
            if (iP > 0 && iP <= catalogo.size()) {
                Perk sel = catalogo[iP-1];
                p.puntiCreazione += sel.costo;
                p.aggiungiPerk(sel);
                std::cout << "Perk aggiunto!\n";
            }
        }
        if (scelta == 3 && p.puntiCreazione < 0) {
            std::cout << "ATTENZIONE: Sei in debito di punti (" << p.puntiCreazione << ")! Aggiungi dei malus.\n";
            scelta = 0;
        } else if (scelta == 3) {
            scelta = 4; // Esci davvero
        }
    }
    party.push_back(p);
}

void gestisciPersonaggi(std::vector<Personaggio>& party, Magazzino& base, int oreTotali) {
    std::cout << "\n--- SELEZIONA PERSONAGGIO ---\n";
    for(int i=0; i<party.size(); ++i) {
        std::cout << i+1 << ". " << party[i].nome << (party[i].inSpedizione ? " [IN SPEDIZIONE]" : " [IN BASE]") << "\n";
    }
    int pIdx; std::cin >> pIdx;
    if (pIdx < 1 || pIdx > (int)party.size()) return;
    Personaggio& p = party[pIdx-1];

    if (p.inSpedizione) {
        menuSpedizione(p);
    } else {
        std::cout << "1. Controlla Scheda\n2. Manda in Spedizione\n3. Sfamare/Dissetare\n4. Allenamento\nScelta: ";
        int s; std::cin >> s;
        if (s == 1) p.mostraScheda();
        else if (s == 2) { 
            p.inSpedizione = true; 
            p.preparaSpedizione(); 
        }
        else if (s == 3) { 
            base.sfama(p, 1.0f); // Supponendo che sfama accetti quantità
            base.disseta(p, 1.0f); 
        }
        else if (s == 4) {
            std::string arma;
            int ore;
            std::cout << "Tipo arma (Archi/Armi da fuoco/Lame Leggere): ";
            clearCin();
            std::getline(std::cin, arma);
            std::cout << "Ore di allenamento: ";
            std::cin >> ore;
            p.allenamentoArma(arma, ore);
        }
    }
}

void menuSpedizione(Personaggio& p) {
    int s = 0;
    while (s != 3) {
        std::cout << "\n--- MENU SPEDIZIONE: " << p.nome << " ---\n";
        std::cout << "1. Registra Battaglia Vinta\n2. Ritorna alla Base\n3. Indietro\nScelta: ";
        std::cin >> s;
        if (s == 1) p.registraBattaglia();
        else if (s == 2) { 
            p.inSpedizione = false; 
            std::cout << p.nome << " e' tornato alla base.\n";
            return;
        }
    }
}
*/