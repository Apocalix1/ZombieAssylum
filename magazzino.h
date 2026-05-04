#ifndef MAGAZZINO_H
#define MAGAZZINO_H

#include <string>
#include <iostream>
#include "personaggi.h" 

struct MaterialiMedici {
    int base=0;
    int avanzati=0;
    int critici=0;
};

class Magazzino {
private:
    float cibo;
    float acqua;
    int ingranaggi;
    int matMedico;
    int matAlchemico;

public:
    // Costruttore
    Magazzino(float c = 0, float a = 0, int ingr = 0, int med = 0, int alch = 0);
    
    // Metodi per aggiungere risorse (Loot)
    void aggiungiRisorse(std::string tipo, float quantita);
    
    // Metodi per visualizzare lo stato
    void mostraStato() const;

    MaterialiMedici medKit;

    // Metodi core: Sfamare e Dissetare
    // Restituiscono true se l'operazione ha successo, false se mancano risorse
    bool sfama(Personaggio& p, float quantitaCibo);
    bool disseta(Personaggio& p, float quantitaAcqua);

    // Getters semplici
    float getCibo() const { return cibo; }
    float getAcqua() const { return acqua; }
};

#endif