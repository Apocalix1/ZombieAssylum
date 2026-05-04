#ifndef PERSONAGGI_H
#define PERSONAGGI_H

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <cmath>

// Struttura per gestire i punti esperienza e i livelli (Artificeria, Armi, ecc.)
struct Progressione {
    int livello = 0;
    float puntiAccumulati = 0.0f;
};

class Personaggio {
public:
    // --- Identità e Statistiche ---
    std::string nome;
    std::map<std::string, int> stats; // Forza, Destrezza, Costituzione, Intelligenza, Saggezza, Carisma
    
    // --- Punti Ferita e Risorse Fisiche ---
    int pfFortuna;          // Base 15
    int pfReali;            // Base 5
    int stamina;            // Base 5
    int fatica;             // Livelli da 1 a 6
    int velocita;           // Gestita dai debuff fatica

    // --- Sopravvivenza (Tacche) ---
    int fame;               // Max 14
    int sete;               // Max 4
    int sonno;              // Max 8
    int follia;             // Nascosta (0-10)

    // --- Buff Temporanei (da surplus cibo/acqua/sonno) ---
    int buffForza = 0;
    int buffCostituzione = 0;
    int buffDestrezza = 0;
    int buffSaggezza = 0;
    int buffCarisma = 0;
    int buffIntelligenza = 0;

    // --- Flag Metabolismo (consumo > 1 unità) ---
    bool metabolismoLentoCibo = false;
    bool metabolismoLentoSete = false;

    // --- Competenze e Progressioni ---
    Progressione artificeriaGenerale;
    std::map<std::string, Progressione> specializzazioni; // Balistica, Meccanica, Elettronica
    std::map<std::string, Progressione> competenzeArmi;  // Arco, Lame, Pistola, ecc.
    
    // Competenze GDR (-1 svantaggio, 0 nulla, 1 comp, 2 maestria)
    std::map<std::string, int> gradiCompetenza; 
    std::map<std::string, int> puntiApprendimento; // Per il sistema a 70/140 punti

    int battaglieVinte;

    int pfFortunaMax = 15;
    bool inSpedizione = false;

    // --- Metodi ---
    Personaggio(std::string n);
    
    // Restituisce il modificatore calcolato + eventuali buff
    int getModificatore(std::string stat);
    
    // Calcola il CD finale per il crafting (Artificeria)
    int calcolaCDArtificeria(int cdBase, std::string spec, bool haProgetto);

    // Gestione esperienza
    void aggiungiPS(std::string spec, int punti); // PS Specializzazione -> 0.25 PAG
    void aggiungiPCA(std::string arma, float punti); // Punti Competenza Armi
    
    // Avanzamento Temporale
    void avanzaTempo(int ore); 
    
    void mostraScheda();

    void registraBattaglia();

    void allenamentoArma(std::string arma, int ore);
};

#endif