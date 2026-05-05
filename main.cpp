#include <iostream>
#include <vector>
#include <string>
#include <limits>
#include <algorithm>
#include "personaggi.h"
#include "magazzino.h"

// --- PROTOTIPI ---
void menuCreazione(std::vector<Personaggio>& party);
void gestisciPersonaggi(std::vector<Personaggio>& party, Magazzino& base);
void menuSpedizione(Personaggio& p);
void mostraIdentita(const Personaggio& p);

// --- HELPER PER INPUT PULITO ---
void clearCin() {
    std::cin.clear();
    std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
}

int main() {
    std::vector<Personaggio> party;
    Magazzino base(10.0f, 5.0f, 0, 0, 0);
    int scelta = 0;

    while (scelta != 9) {
        std::cout << "\n========== ZOMBIE ASYLUM GESTIONALE ==========\n";
        std::cout << "1. Crea Nuovo Personaggio\n";
        std::cout << "2. Controlla Magazzino\n";
        if (!party.empty()) {
            std::cout << "3. GESTISCI PERSONAGGI (" << party.size() << " attivi)\n";
        }
        std::cout << "9. Esci\n";
        std::cout << "----------------------------------------------\nScelta: ";
        if (!(std::cin >> scelta)) { clearCin(); continue; }

        switch (scelta) {
            case 1: menuCreazione(party); break;
            case 2: base.mostraStato(); break;
            case 3: if (!party.empty()) gestisciPersonaggi(party, base); break;
        }
    }
    return 0;
}

void mostraIdentita(const Personaggio& p) {
    std::cout << "\n--- IDENTITA' ATTUALE ---\n";
    std::cout << "Nome: " << p.nome << "\n";
    std::cout << "Monete d'Argento: " << p.moneteArgento << "\n";
    std::cout << "Lingue: " << p.lingueConosciute << "\n";
    std::cout << "Equipaggiamento: " << p.equipaggiamento << "\n";
    std::cout << "Fobie: ";
    bool haFobie = false;
    for(const auto& perk : p.perksAttivi) {
        if(!perk.motivoPanico.empty()) { std::cout << "[" << perk.motivoPanico << "] "; haFobie = true; }
    }
    if(!haFobie) std::cout << "Nessuna";
    std::cout << "\n-------------------------\n";
}

void menuCreazione(std::vector<Personaggio>& party) {
    std::string nome;
    std::cout << "Inserisci il nome del sopravvissuto: ";
    clearCin(); // Pulisce residui prima di getline
    std::getline(std::cin, nome);
    
    Personaggio p(nome);
    
    std::vector<Perk> catalogo = {
        {"Amicizia", "Aumenta CA alleato di 2.", -2, "", false},
        {"Leader nato", "+1 CAR ogni 2 alleati.", -3, "", true}, // Accumulabile
        {"Abbandono", "Panico se solo.", 3, "Solitudine", false},
        {"Paranoico", "Ossessione giornaliera.", 4, "Ansia", true} // Accumulabile
    };

    int scelta = 0;
    while (scelta != 4) {
        mostraIdentita(p);
        std::cout << "PUNTI DISPONIBILI: " << p.puntiCreazione << "\n";
        std::cout << "1. Potenzia Caratteristiche (8-20)\n2. Scegli Perk/Malus\n3. Modifica Equip/Dati\n4. Salva e Chiudi\nScelta: ";
        std::cin >> scelta;

        if (scelta == 1) {
            int s;
            std::cout << "Scegli (1.FOR 2.DES 3.COS 4.INT 5.SAG 6.CAR): ";
            std::cin >> s;
            if (s < 1 || s > 6) { std::cout << "Errore!\n"; continue; }
            
            std::string statNome = (s==1)?"Forza":(s==2)?"Destrezza":(s==3)?"Costituzione":(s==4)?"Intelligenza":(s==5)?"Saggezza":"Carisma";
            int* valAttuale = (s==1)?&p.forza:(s==2)?&p.destrezza:(s==3)?&p.costituzione:(s==4)?&p.intelligenza:(s==5)?&p.saggezza:&p.carisma;

            int quanti;
            std::cout << "Di quanti punti vuoi aumentare " << statNome << "? ";
            std::cin >> quanti;

            for (int i = 0; i < quanti; ++i) {
                if (*valAttuale >= 20) {
                    std::cout << "Raggiunto il limite di 20 per " << statNome << "!\n";
                    break;
                }
                int costo = p.calcolaCostoStat(*valAttuale);
                if (p.puntiCreazione >= costo) {
                    p.puntiCreazione -= costo;
                    (*valAttuale)++;
                    std::cout << "Incremento effettuato! " << statNome << ": " << *valAttuale << " (Punti rimasti: " << p.puntiCreazione << ")\n";
                } else {
                    std::cout << "Punti insufficienti per l'ulteriore incremento a " << (*valAttuale + 1) << " (Costo: " << costo << ")\n";
                    break;
                }
            }
        }
        else if (scelta == 2) {
            for(int i=0; i<catalogo.size(); ++i) {
                std::cout << i+1 << ". " << catalogo[i].nome << " (" << catalogo[i].costo << ")\n";
            }
            int iP; std::cin >> iP;
            if (iP > 0 && iP <= catalogo.size()) {
                Perk sel = catalogo[iP-1];
                
                // Controllo se già posseduto e non accumulabile
                auto it = std::find_if(p.perksAttivi.begin(), p.perksAttivi.end(), [&](const Perk& pk){ return pk.nome == sel.nome; });
                if (it != p.perksAttivi.end() && !sel.accumulabile) {
                    std::cout << "Hai gia' questo Perk!\n";
                } else if (p.puntiCreazione + sel.costo < 0 && sel.costo < 0) {
                    std::cout << "Non puoi permettertelo!\n";
                } else {
                    p.puntiCreazione += sel.costo;
                    p.perksAttivi.push_back(sel);
                }
            }
        }
        else if (scelta == 4 && p.puntiCreazione < 0) {
            std::cout << "Debito di punti! Aggiungi Malus o riduci statistiche.\n";
            scelta = 0;
        }
    }
    party.push_back(p);
}

void gestisciPersonaggi(std::vector<Personaggio>& party, Magazzino& base) {
    std::cout << "\n--- SELEZIONA PERSONAGGIO ---\n";
    for(int i=0; i<party.size(); ++i) {
        std::cout << i+1 << ". " << party[i].nome << (party[i].inSpedizione ? " [IN SPEDIZIONE]" : " [IN BASE]") << "\n";
    }
    int pIdx; std::cin >> pIdx;
    if (pIdx < 1 || pIdx > party.size()) return;
    Personaggio& p = party[pIdx-1];

    if (p.inSpedizione) {
        menuSpedizione(p);
    } else {
        std::cout << "1. Controlla Scheda\n2. Manda in Spedizione\n3. Sfamare/Dissetare\n4. Allenamento\nScelta: ";
        int s; std::cin >> s;
        if (s == 1) p.mostraScheda();
        else if (s == 2) { p.inSpedizione = true; p.preparaSpedizione(); }
        else if (s == 3) { base.sfama(p, 1.0f); base.disseta(p, 1.0f); }
        else if (s == 4) { /* chiama p.allenamentoArma con input */ }
    }
}

void menuSpedizione(Personaggio& p) {
    int s;
    std::cout << "\n--- MENU SPEDIZIONE: " << p.nome << " ---\n";
    std::cout << "1. Registra Colpi (GPA)\n2. Completa Battaglia\n3. Ritorna alla Base\nScelta: ";
    std::cin >> s;
    if (s == 1) { /* logica GPA */ }
    else if (s == 2) p.registraBattaglia();
    else if (s == 3) p.inSpedizione = false;
}