#include "magazzino.h"

Magazzino::Magazzino(float c, float a, int ingr, int med, int alch) 
    : cibo(c), acqua(a), ingranaggi(ingr), matMedico(med), matAlchemico(alch) {}

void Magazzino::aggiungiRisorse(std::string tipo, float quantita) {
    if (tipo == "cibo") cibo += quantita;
    else if (tipo == "acqua") acqua += quantita;
    else if (tipo == "ingranaggi") ingranaggi += (int)quantita;
    else if (tipo == "medico") matMedico += (int)quantita;
    else if (tipo == "alchemico") matAlchemico += (int)quantita;
}

void Magazzino::mostraStato() const {
    std::cout << "\n--- STATO MAGAZZINO ---" << std::endl;
    std::cout << "Cibo: " << cibo << " unita'" << std::endl;
    std::cout << "Acqua: " << acqua << " unita'" << std::endl;
    std::cout << "Ingranaggi: " << ingranaggi << std::endl;
    std::cout << "Materiale Medico: " << matMedico << std::endl;
    std::cout << "Materiale Alchemico: " << matAlchemico << std::endl;
    std::cout << "-----------------------" << std::endl;
}

bool Magazzino::sfama(Personaggio& p, float quantitaCibo) {
    if (cibo < quantitaCibo) {
        std::cout << "ERRORE: Non c'e' abbastanza cibo in magazzino!" << std::endl;
        return false;
    }

    cibo -= quantitaCibo;
    
    // 1 unita' cibo = 14 tacche (1 giorno intero)
    int taccheRecuperate = (int)(quantitaCibo * 14.0f);
    p.fame += taccheRecuperate;

    // Gestione Buff e Limiti
    if (p.fame >= 14) {
        p.fame = 14;
        p.buffForza = 1;
        p.buffCostituzione = 1;
        std::cout << p.nome << " si sente pieno! Ottiene +1 a Forza e Costituzione." << std::endl;
    }

    // Metabolismo rallentato se consuma più di 1 intero
    if (quantitaCibo > 1.0f) {
        p.metabolismoLentoCibo = true;
        std::cout << "Metabolismo di " << p.nome << " rallentato per surplus alimentare." << std::endl;
    }

    return true;
}

bool Magazzino::disseta(Personaggio& p, float quantitaAcqua) {
    if (acqua < quantitaAcqua) {
        std::cout << "ERRORE: Non c'e' abbastanza acqua in magazzino!" << std::endl;
        return false;
    }

    acqua -= quantitaAcqua;
    
    // 1 unita' acqua = 4 tacche (1 giorno intero)
    int taccheRecuperate = (int)(quantitaAcqua * 4.0f);
    p.sete += taccheRecuperate;

    // Gestione Buff e Limiti
    if (p.sete >= 4) {
        p.sete = 4;
        p.buffDestrezza = 1;
        p.buffSaggezza = 1;
        std::cout << p.nome << " si sente dissetato! Ottiene +1 a Destrezza e Saggezza." << std::endl;
    }

    if (quantitaAcqua > 1.0f) {
        p.metabolismoLentoSete = true;
    }

    return true;
}