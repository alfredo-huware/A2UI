def get_offerta_process() -> str:
    """
    Returns the dimensionamento process for the specified project.

    Returns:
        A message indicating that the deployment process has started.
    """
    return f"""✅ Checklist — Processo Sviluppo Offerta (P2.1 Rev. 5)
📌 FASE 1 — Analisi della Richiesta (P2.1.1)
#	Attività	Owner
☐ 1	Ricevere e archiviare correttamente la documentazione del Cliente (download da portale o mail)	Sales
☐ 2	Analisi preliminare della documentazione ricevuta	Sales
☐ 3	Riunione operativa Team Proposal + Sales	Sales + Responsabile Proposal
☐ 4	Definire il livello dell'offerta (analitica / parametrica / budgettaria) e la deliverables list	Sales + Responsabile Proposal
☐ 5	Definire la data di fabbisogno dell'offerta tecnica ed economica	Sales + Responsabile Proposal
☐ 6	Richiedere eventuale proroga tempi di consegna se necessario	Team Sales
☐ 7	Definire il team Proposal che segue il progetto	Sales Man. + Responsabile Proposal
☐ 8	Inserire il progetto nella pianificazione dell'ufficio	Responsabile Proposal
☐ 9	Apertura preventivo nel SW di estimo (CPQ) con numerazione PTV	Cost Estimator
☐ 10	Creare la directory di lavoro in rete	Proposal
☐ 11	[Evento M201 – Kick-off Offerta]: Definire lingua, valuta, tipologia contratto, vincoli, import/local, deliverables list dettagliata	Team Sales + Team VD
☐ 12	Consultare MD 6618 Check-list Sales & Proposal	Team Sales + Team VD
☐ 13	[Evento M202]: Definire strategia sourcing e lista fornitori da coinvolgere	Proposal Engineering + All Geico Project"""

