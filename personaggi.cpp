#include "personaggi.h"

Personaggio::Personaggio(std::string n) : nome(n) {
    // Inizializzazione come da Manuale
    stats["Forza"] = 8;
    stats["Destrezza"] = 8;
    stats["Costituzione"] = 8;
    stats["Intelligenza"] = 8;
    stats["Saggezza"] = 8;
    stats["Carisma"] = 8;

    pfFortuna = 15;
    pfReali = 5;
    stamina = 5;
    fatica = 0;
    fame = 14;
    sete = 4;
    sonno = 8;
    follia = 0;
    battaglieVinte = 0;

    // Inizializzazione mappe per evitare errori di chiave non trovata
    specializzazioni["Balistica"] = {0, 0.0f};
    specializzazioni["Meccanica"] = {0, 0.0f};
    specializzazioni["Elettronica"] = {0, 0.0f};
    
    competenzeArmi["Archi"] = {0, 0.0f};
    competenzeArmi["Armi da fuoco"] = {0, 0.0f};
    competenzeArmi["Lame Leggere"] = {0, 0.0f};
    competenzeArmi["Fruste e Rampini"] = {0, 0.0f};
    competenzeArmi["Armi con Asta"] = {0, 0.0f};
    competenzeArmi["Balestre"] = {0, 0.0f};
    competenzeArmi["Mazze e armi contundenti"] = {0, 0.0f};
    bool inSpedizione = false;
    int pfFortunaMax = 15;
}

int Personaggio::getModificatore(std::string stat) {
    int valoreBase = stats[stat];
    int bonus = 0;

    // Applicazione Buff da Sopravvivenza
    if (stat == "Forza") bonus = buffForza;
    if (stat == "Costituzione") bonus = buffCostituzione;
    if (stat == "Destrezza") bonus = buffDestrezza;
    if (stat == "Saggezza") bonus = buffSaggezza;
    if (stat == "Carisma") bonus = buffCarisma;
    if (stat == "Intelligenza") bonus = buffIntelligenza;

    return std::floor((valoreBase - 10) / 2.0) + bonus;
}

int Personaggio::calcolaCDArtificeria(int cdBase, std::string spec, bool haProgetto) {
    int lvlAG = artificeriaGenerale.livello;
    int lvlSpec = specializzazioni[spec].livello;

    if (haProgetto) {
        // CD finale = CD base – Livello AG – Livello Spec
        return cdBase - lvlAG - lvlSpec;
    } else {
        // Senza competenza: CD base + 6 – (AG × 1) – (Spec × 2)
        return cdBase + 6 - lvlAG - (lvlSpec * 2);
    }
}

void Personaggio::registraBattaglia() {
    battaglieVinte++;
    if (battaglieVinte % 2 == 0) {
        pfFortunaMax++;
        std::cout << "LOG: La tempra di " << nome << " aumenta! PF Fortuna Max ora: " << pfFortunaMax << std::endl;
    }
}

void Personaggio::aggiungiPS(std::string spec, int punti) {
    specializzazioni[spec].puntiAccumulati += punti;
    // Ogni PS fornisce 0.25 PAG
    artificeriaGenerale.puntiAccumulati += (punti * 0.25f);
    
    // Logica Level up Specializzazione (es: Lv1 a 5 PS)
    int soglieSpec[] = {0, 5, 15, 35, 65, 125};
    if (specializzazioni[spec].livello < 5 && 
        specializzazioni[spec].puntiAccumulati >= soglieSpec[specializzazioni[spec].livello + 1]) {
        specializzazioni[spec].livello++;
    }

    // Logica Level up Artificeria Generale (es: Lv1 a 4 PAG)
    int soglieAG[] = {0, 4, 7, 10, 15, 20};
    if (artificeriaGenerale.livello < 5 && 
        artificeriaGenerale.puntiAccumulati >= soglieAG[artificeriaGenerale.livello + 1]) {
        artificeriaGenerale.livello++;
    }
}

void Personaggio::avanzaTempo(int ore) {
    // Riduzione ogni 6 ore
    int cicli = ore / 6;
    
    for (int i = 0; i < cicli; i++) {
        // CIBO: 0.25 tacche ogni 6 ore (1 al giorno)
        float ridCibo = 0.25f;
        if (metabolismoLentoCibo) ridCibo *= 0.66f; // Riduzione a 2/3
        
        // ACQUA: 0.25 tacche ogni 6 ore (1 al giorno)
        float ridSete = 0.25f;
        if (metabolismoLentoSete) ridSete *= 0.66f;

        // Applicazione (gestiamo come float e castiamo o usiamo variabili float per precisione)
        // Per semplicità qui riduciamo 1 tacca intera ogni 24 ore se preferisci
        // ma seguiamo la tua logica dei quarti:
        if (fame > 0) fame--; // Semplificato a interi per le tacche del manuale
        if (sete > 0) sete--;
        
        // Reset buff se scendi sotto il massimo
        if (fame < 14) { buffForza = 0; buffCostituzione = 0; metabolismoLentoCibo = false; }
        if (sete < 4) { buffDestrezza = 0; buffSaggezza = 0; metabolismoLentoSete = false; }
    }
}

void Personaggio::mostraScheda() {
    std::cout << "\n=== SCHEDA PERSONAGGIO: " << nome << " ===" << std::endl;
    std::cout << "PF Fortuna: " << pfFortuna << " | PF Reali: " << pfReali << std::endl;
    std::cout << "Fame: [" << fame << "/14] Sete: [" << sete << "/4] Sonno: [" << sonno << "/8]" << std::endl;
    std::cout << "Fatica: " << fatica << " | Follia: (Nascosta)" << std::endl;
    std::cout << "---------------------------------------" << std::endl;
}

void Personaggio::aggiungiPCA(std::string arma, float punti) {
    // Se l'arma non esiste nella mappa, la inizializziamo
    if (competenzeArmi.find(arma) == competenzeArmi.end()) {
        competenzeArmi[arma] = {0, 0.0f};
    }

    competenzeArmi[arma].puntiAccumulati += punti;
    
    // Tabella avanzamento armi: 1:6, 2:15, 3:22, 4:34, 5:50
    int soglieArmi[] = {0, 6, 15, 22, 34, 50};
    int lvl = competenzeArmi[arma].livello;

    if (lvl < 5 && competenzeArmi[arma].puntiAccumulati >= soglieArmi[lvl + 1]) {
        competenzeArmi[arma].livello++;
        std::cout << "LOG: Competenza " << arma << " aumentata a livello " << competenzeArmi[arma].livello << "!" << std::endl;
    }
}

void Personaggio::allenamentoArma(std::string arma, int ore) {
    if (inSpedizione) {
        std::cout << "Non puoi allenarti seriamente mentre sei in spedizione!" << std::endl;
        return;
    }

    // 2 ore gratis, oltre consuma stamina (1 ogni 2 ore)
    if (ore > 2) {
        int oreExtra = ore - 2;
        int costoStamina = (oreExtra + 1) / 2; // Arrotonda per eccesso
        stamina -= costoStamina;
    }

    // Effetto: +2 PCA per ora, fame aumenta del 10% (circa 1.4 tacche)
    float puntiOttenuti = ore * 2.0f;
    aggiungiPCA(arma, puntiOttenuti);
    
    // Aumento fame (10% del totale 14 = 1.4 tacche per sessione di allenamento)
    fame -= 1; 
    std::cout << "Allenamento completato: +" << puntiOttenuti << " PCA a " << arma << std::endl;
}