import React from 'react';

/**
 * Point d'entrée de la Web App Mobile (PWA) AssoCompta Scan.
 * Voir les tickets GitHub Issues (MOB-01 à MOB-09) pour l'implémentation des écrans et du bouton d'installation PWA.
 */
export default function App() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#020617', color: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: 16, padding: 24, maxWidth: 400, width: '100%' }}>
        <div style={{ color: '#34d399', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginBottom: 8 }}>
          ASSOCOMPTA SCAN (PWA MOBILE)
        </div>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10, marginTop: 0 }}>
          Dépôt de Pièces Justificatives & Remboursements
        </h1>
        <p style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          Socle Web App Mobile (PWA installable sur écran d'accueil Android & iPhone sans Store) prêt pour les tickets MOB-01 à MOB-09.
        </p>
      </div>
    </div>
  );
}
