#include "personaggi.h"
#include <iostream>
#include <cmath>
#include <vector>
#include <algorithm>

// =====================================================================
// COSTRUTTORE
// =====================================================================
Personaggio::Personaggio(std::string n) : nome(n) {
    // Statistiche Base
    forza = destrezza = costituzione = intelligenza = saggezza = carisma = 8;
    
    // Punti Vita e Risorse
    pfFortuna = 15;
    pfFortunaMax = 15;
    pfReali = 5;
    stamina = 5;
    fatica = 0;
    
    // Bisogni e Stati
    fame = 14;
    sete = 4;
    sonno = 8;
    follia = 0;
    
    // Progresso
    battaglieVinte = 0;
    giorniAttivi = 0;
    puntiCreazione = 27;
    moneteArgento = 0;
    inSpedizione = false;
    
    // Materiali
    componentiMedici = 0;
    componentiAlchemici = 0;
    ingranaggi = 0;

    // Buff/Debuff iniziali
    buffForza = buffDestrezza = buffCostituzione = 0;
    buffIntelligenza = buffSaggezza = buffCarisma = 0;
    metabolismoLentoCibo = false;
    metabolismoLentoSete = false;

    // Specializzazioni Artificeria
    specializzazioni["Balistica"] = {0, 0.0f};
    specializzazioni["Meccanica"] = {0, 0.0f};
    specializzazioni["Elettronica"] = {0, 0.0f};
    artificeriaGenerale = {0, 0.0f};
    
    // Competenze Armi
    competenzeArmi["Archi"] = {0, 0.0f};
    competenzeArmi["Armi da fuoco"] = {0, 0.0f};
    competenzeArmi["Lame Leggere"] = {0, 0.0f};

    lingueConosciute = "Verbum";
    equipaggiamento = "Nullo";

    // Inizializzazione Mappa Abilità
    std::vector<std::string> listaAbilità = {
        "Atletica", "Acrobazia", "Furtivita", "Rapidita di mano", 
        "Arcano", "Storia", "Indagare", "Natura", "Religione",
        "Intuizione", "Percezione", "Sopravvivenza", "Addestrare animali",
        "Inganno", "Intimidire", "Intrattenere", "Persuasione",
        "Cucina", "Manodopera"
    };

    for (const auto& ab : listaAbilità) {
        abilità[ab] = 0; 
    }
}

// =====================================================================
// SISTEMA DI CALCOLO
// =====================================================================

int Personaggio::getModificatore(std::string stat) {
    int valoreBase = 8;
    int bonus = 0;

    if (stat == "Forza") { valoreBase = forza; bonus = buffForza; }
    else if (stat == "Costituzione") { valoreBase = costituzione; bonus = buffCostituzione; }
    else if (stat == "Destrezza") { valoreBase = destrezza; bonus = buffDestrezza; }
    else if (stat == "Saggezza") { valoreBase = saggezza; bonus = buffSaggezza; }
    else if (stat == "Carisma") { valoreBase = carisma; bonus = buffCarisma; }
    else if (stat == "Intelligenza") { valoreBase = intelligenza; bonus = buffIntelligenza; }

    return static_cast<int>(std::floor((valoreBase - 10) / 2.0)) + bonus;
}

int Personaggio::getBonusCompetenza() {
    if (giorniAttivi < 7) return 2;
    if (giorniAttivi < 14) return 3;
    if (giorniAttivi < 21) return 4;
    return 5;
}

int Personaggio::getTiroAbilità(std::string nomeAbilità, std::string statAssociata) {
    int modStat = getModificatore(statAssociata);
    int bonusComp = getBonusCompetenza();
    int grado = abilità[nomeAbilità];

    if (grado == 2) return modStat + (bonusComp * 2); // Maestria
    if (grado == 1) return modStat + bonusComp;       // Competenza
    if (grado == -1) return modStat - bonusComp;      // Competenza Negativa
    return modStat;                                   // Grado 0
}

// =====================================================================
// GESTIONE PROGRESSIONE E ABILITÀ
// =====================================================================

void Personaggio::aggiungiCompetenza(std::string nomeAbilità, int tipo) {
    int& gradoAttuale = abilità[nomeAbilità];
    if (tipo == 1) { 
        if (gradoAttuale < 2) gradoAttuale++;
    } 
    else if (tipo == -1) { 
        if (gradoAttuale > -1) gradoAttuale--;
    }
}

void Personaggio::registraBattaglia() {
    battaglieVinte++;
    if (battaglieVinte % 2 == 0) {
        pfFortunaMax++;
        std::cout << "LOG: La tempra di " << nome << " aumenta! PF Fortuna Max ora: " << pfFortunaMax << std::endl;
    }
}

// =====================================================================
// ARTIFICERIA E ALLENAMENTO
// =====================================================================

int Personaggio::calcolaCDArtificeria(int cdBase, std::string spec, bool haProgetto) {
    int lvlAG = artificeriaGenerale.livello;
    int lvlSpec = specializzazioni[spec].livello;
    return haProgetto ? (cdBase - lvlAG - lvlSpec) : (cdBase + 6 - lvlAG - (lvlSpec * 2));
}

void Personaggio::aggiungiPS(std::string spec, int punti) {
    specializzazioni[spec].puntiAccumulati += punti;
    artificeriaGenerale.puntiAccumulati += (punti * 0.25f);
    
    int soglieSpec[] = {0, 5, 15, 35, 65, 125};
    int soglieAG[] = {0, 4, 7, 10, 15, 20};

    while (specializzazioni[spec].livello < 5 && specializzazioni[spec].puntiAccumulati >= soglieSpec[specializzazioni[spec].livello + 1]) 
        specializzazioni[spec].livello++;

    while (artificeriaGenerale.livello < 5 && artificeriaGenerale.puntiAccumulati >= soglieAG[artificeriaGenerale.livello + 1]) 
        artificeriaGenerale.livello++;
}

void Personaggio::aggiungiPCA(std::string arma, float punti) {
    if (competenzeArmi.find(arma) == competenzeArmi.end()) competenzeArmi[arma] = {0, 0.0f};
    competenzeArmi[arma].puntiAccumulati += punti;
    
    int soglieArmi[] = {0, 6, 15, 22, 34, 50};
    while (competenzeArmi[arma].livello < 5 && competenzeArmi[arma].puntiAccumulati >= soglieArmi[competenzeArmi[arma].livello + 1]) {
        competenzeArmi[arma].livello++;
        std::cout << "LOG: Livello " << arma << " aumentato a " << competenzeArmi[arma].livello << "!" << std::endl;
    }
}

void Personaggio::allenamentoArma(std::string arma, int ore) {
    if (inSpedizione) return;
    if (ore > 2) stamina -= (ore - 2 + 1) / 2;
    aggiungiPCA(arma, static_cast<float>(ore * 2.0f));
    if (fame > 0) fame--;
    std::cout << "Allenamento completato per " << arma << std::endl;
}

// =====================================================================
// MECCANICHE DI GIOCO
// =====================================================================

void Personaggio::avanzaTempo(int ore) {
    int cicli = ore / 6;
    for (int i = 0; i < cicli; i++) {
        if (fame > 0) fame--;
        if (sete > 0) sete--;
        if (fame < 14) { buffForza = 0; buffCostituzione = 0; metabolismoLentoCibo = false; }
        if (sete < 4) { buffDestrezza = 0; buffSaggezza = 0; metabolismoLentoSete = false; }
    }
}

void Personaggio::preparaSpedizione() {
    componentiMedici = 0;
    componentiAlchemici = 0;
    ingranaggi = 0;
    inSpedizione = true;
    std::cout << ">>> Spedizione pronta! Materiali depositati nel magazzino base.\n";
}

int Personaggio::calcolaCostoStat(int valoreAttuale) {
    if (valoreAttuale >= 8 && valoreAttuale < 12) return 1;
    if (valoreAttuale >= 12 && valoreAttuale < 16) return 2;
    if (valoreAttuale >= 16 && valoreAttuale < 19) return 3;
    if (valoreAttuale == 19) return 4;
    return 999; 
}

void Personaggio::aumentaStatistica(std::string stat) {
    int* s = nullptr;
    if (stat == "Forza") s = &forza;
    else if (stat == "Destrezza") s = &destrezza;
    else if (stat == "Costituzione") s = &costituzione;
    else if (stat == "Intelligenza") s = &intelligenza;
    else if (stat == "Saggezza") s = &saggezza;
    else if (stat == "Carisma") s = &carisma;

    if (s && *s < 20) {
        int costo = calcolaCostoStat(*s);
        if (puntiCreazione >= costo) {
            puntiCreazione -= costo;
            (*s)++;
            std::cout << stat << " +1! Punti rimasti: " << puntiCreazione << "\n";
        }
    }
}

void Personaggio::aggiungiPerk(Perk p) {
    perksAttivi.push_back(p);
}

// =====================================================================
// INTERFACCIA UTENTE
// =====================================================================

void Personaggio::mostraScheda() {
    std::cout << "\n==================================================" << std::endl;
    std::cout << " SCHEDA PERSONAGGIO: " << nome << std::endl;
    std::cout << "==================================================" << std::endl;
    
    // --- STATISTICHE ---
    std::cout << " FOR: " << forza << " (" << (getModificatore("Forza") >= 0 ? "+" : "") << getModificatore("Forza") << ")"
              << " | INT: " << intelligenza << " (" << (getModificatore("Intelligenza") >= 0 ? "+" : "") << getModificatore("Intelligenza") << ")\n"
              << " DES: " << destrezza << " (" << (getModificatore("Destrezza") >= 0 ? "+" : "") << getModificatore("Destrezza") << ")"
              << " | SAG: " << saggezza << " (" << (getModificatore("Saggezza") >= 0 ? "+" : "") << getModificatore("Saggezza") << ")\n"
              << " COS: " << costituzione << " (" << (getModificatore("Costituzione") >= 0 ? "+" : "") << getModificatore("Costituzione") << ")"
              << " | CAR: " << carisma << " (" << (getModificatore("Carisma") >= 0 ? "+" : "") << getModificatore("Carisma") << ")\n";

    std::cout << "--------------------------------------------------" << std::endl;
    std::cout << " PF Fortuna: " << pfFortuna << "/" << pfFortunaMax << " | PF Reali: " << pfReali << std::endl;
    std::cout << " Monete Argento: " << moneteArgento << " | Lingue: " << lingueConosciute << std::endl;
    
    std::cout << "\n [ PROGRESSO TEMPORALE ]" << std::endl;
    std::cout << " Giorni di attivita: " << giorniAttivi << " | Bonus Competenza: +" << getBonusCompetenza() << std::endl;

    std::cout << "\n [ ABILITA' RILEVANTI ]" << std::endl;
    for (auto const& [skillNome, grado] : abilità) {
        if (grado != 0) {
            std::string label = (grado == 2) ? "MAESTRIA" : (grado == 1 ? "COMPETENZA" : "NEGATIVA");
            // Nota: Qui servirebbe una mappa per associare automaticamente l'abilità alla sua stat base
            std::cout << " * " << skillNome << ": " << label << "\n"; 
        }
    }
    
    // --- PERK ATTIVI ---
    std::cout << "\n [ PERK E MALUS ]" << std::endl;
    if (perksAttivi.empty()) {
        std::cout << " Nessun perk selezionato." << std::endl;
    } else {
        for (const auto& p : perksAttivi) {
            std::cout << " * " << p.nome << ": " << p.descrizione << std::endl;
            if (!p.motivoPanico.empty()) {
                std::cout << "   > EFFETTO PANICO: " << p.motivoPanico << std::endl;
            }
        }
    }
    std::cout << "==================================================\n" << std::endl;
}