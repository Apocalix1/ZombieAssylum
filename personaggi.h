#ifndef PERSONAGGI_H
#define PERSONAGGI_H

#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <cmath>

struct Progressione {
    int livello = 0;
    float puntiAccumulati = 0.0f;
};

enum GradoCompetenza {
    SVANTAGGIO_GRAVE = -2, 
    SVANTAGGIO = -1,
    NULLA = 0,
    COMPETENZA = 1,
    MAESTRIA = 2
};

struct Perk {
    std::string nome;
    std::string descrizione;
    int costo; 
    std::string motivoPanico;
    bool accumulabile = false;
};

class Personaggio {
public:
    // --- Identità e Statistiche ---
    std::string nome;
    int forza = 8;
    int destrezza = 8;
    int costituzione = 8;
    int intelligenza = 8;
    int saggezza = 8;
    int carisma = 8;
    
    int puntiCreazione = 30;
    std::vector<Perk> perksAttivi;

    // --- Punti Ferita e Risorse Fisiche ---
    int pfFortuna;          
    int pfReali;            
    int stamina;            
    int fatica;             
    int velocita;           

    // --- Sopravvivenza (Tacche) ---
    int fame;               
    int sete;               
    int sonno;              
    int follia;  
    int giorniAttivi = 0;           

    // --- Buff Temporanei ---
    int buffForza = 0, buffCostituzione = 0, buffDestrezza = 0;
    int buffSaggezza = 0, buffCarisma = 0, buffIntelligenza = 0;

    bool inPanico = false;
    int moneteArgento = 2;
    bool haPietraComunicante = true;

    // --- Risorse (Aggiunte perché usate nei metodi) ---
    int componentiMedici = 0;
    int componentiAlchemici = 0;
    int ingranaggi = 0;

    bool metabolismoLentoCibo = false;
    bool metabolismoLentoSete = false;

    Progressione artificeriaGenerale;
    std::map<std::string, Progressione> specializzazioni;
    std::map<std::string, Progressione> competenzeArmi;  
    std::map<std::string, int> gradiCompetenza; 
    std::map<std::string, int> puntiApprendimento; 
    std::map<std::string, int> abilità;
    std::string lingueConosciute = "Verbum";
    std::string equipaggiamento = "Nullo";

    int battaglieVinte;
    int pfFortunaMax = 15;
    bool inSpedizione = false;

    // --- Metodi ---
    Personaggio(std::string n);
    int getModificatore(std::string stat);
    int calcolaCDArtificeria(int cdBase, std::string spec, bool haProgetto);
    void aggiungiPS(std::string spec, int punti); 
    void aggiungiPCA(std::string arma, float punti); 
    void avanzaTempo(int ore); 
    void mostraScheda();
    void registraBattaglia();
    void allenamentoArma(std::string arma, int ore);
    void aumentaStatistica(std::string stat);
    void aggiungiPerk(Perk p);
    int calcolaCostoStat(int valoreAttuale);
    void preparaSpedizione();
    int getBonusCompetenza();
    int getTiroAbilità(std::string nomeAbilità, std::string statAssociata);
    void aggiungiCompetenza(std::string nomeAbilita, int tipo);
};

#endif