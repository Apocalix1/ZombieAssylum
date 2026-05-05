#include "magazzino.h"

Magazzino::Magazzino(float c, float a, int ingr, int med, int alch) 
    : cibo(c), acqua(a), ingranaggi(ingr), matMedico(med), matAlchemico(alch) {}

void Magazzino::aggiungiRisorse(std::string tipo, float quantita) {
    if (tipo == "cibo") cibo += quantita;
    else if (tipo == "acqua") acqua += quantita;
    else if (tipo == "ingranaggi") ingranaggi += (int)quantita;
    else if (tipo == "medico") matMedico += (int)quantita;
}

void Magazzino::mostraStato() const {
    std::cout << "\n--- STATO MAGAZZINO BASE ---" << std::endl;
    std::cout << "Cibo: " << cibo << " | Acqua: " << acqua << std::endl;
    std::cout << "Ingranaggi: " << ingranaggi << " | Mat. Alchemici: " << matAlchemico << std::endl;
}

bool Magazzino::sfama(Personaggio& p, float quantita) {
    if (cibo >= quantita) {
        cibo -= quantita;
        // Ogni 1.0 di cibo ripristina 1 tacca di fame (logica semplificata)
        p.fame += (int)(quantita * 1); 
        if (p.fame > 14) p.fame = 14;
        
        // Se mangia molto (es. >= 1.0), ottiene i buff
        if (quantita >= 1.0f) {
            p.buffForza = 1;
            p.buffCostituzione = 1;
            std::cout << ">>> " << p.nome << " e' sazio! (+1 FOR/COS)" << std::endl;
        }
        return true;
    }
    std::cout << "[!] Cibo insufficiente in magazzino!" << std::endl;
    return false;
}

bool Magazzino::disseta(Personaggio& p, float quantita) {
    if (acqua >= quantita) {
        acqua -= quantita;
        p.sete += (int)(quantita * 1);
        if (p.sete > 4) p.sete = 4;
        
        if (quantita >= 1.0f) {
            p.buffDestrezza = 1;
            p.buffSaggezza = 1;
            std::cout << ">>> " << p.nome << " e' idratato! (+1 DES/SAG)" << std::endl;
        }
        return true;
    }
    std::cout << "[!] Acqua insufficiente!" << std::endl;
    return false;
}