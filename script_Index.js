
        let projects = [];
        let responsables = [];
        let gantt;
        let currentView = 'Month';

        const getColor = (name) => {
            let hash = 0;
            if (!name) return '#6366f1';
            for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
            return `hsl(${Math.abs(hash) % 360}, 65%, 50%)`;
        };

        function loadAllData() {
            // Vérification de la disponibilité de Firebase
            if (!window.fbMethods) return setTimeout(loadAllData, 200);
            const { onValue, ref } = window.fbMethods;

            // 1. ÉCOUTEUR DES RESPONSABLES (Chargé une seule fois ou à chaque modif d'équipe)
            onValue(ref(window.fbDB, 'responsables'), (snap) => {
                const data = snap.val();
                responsables = data ? Object.values(data) : [];

                // Mise à jour du formulaire d'ajout/édition
                const pOwner = document.getElementById('p-owner');
                if (pOwner) {
                    pOwner.innerHTML = responsables.map(r =>
                        `<option value="${r.id}">${r.name}</option>`
                    ).join('') || '<option value="">Aucun membre</option>';
                }

                // Mise à jour du filtre principal (Unique source de vérité)
                const filterOwner = document.getElementById('filter-owner');
                if (filterOwner) {
                    filterOwner.innerHTML = '<option value="all">Tous les membres</option>' +
                        responsables.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
                }

                // Rafraîchir le Gantt si les projets sont déjà là pour afficher les noms des responsables
                if (projects.length > 0) renderGantt();
            });

            // 2. ÉCOUTEUR DES PROJETS (Avec logique de tri robuste)
            onValue(ref(window.fbDB, 'projects'), (snap) => {
                const data = snap.val();
                let projectsData = data ? Object.values(data) : [];

                // TRIPLE TRI : Priorité > Date > Nom
                projectsData.sort((a, b) => {
                    const prioA = parseInt(a.priority) || 2;
                    const prioB = parseInt(b.priority) || 2;
                    if (prioA !== prioB) return prioA - prioB;

                    const dateA = a.start ? new Date(a.start) : new Date('2099-12-31');
                    const dateB = b.start ? new Date(b.start) : new Date('2099-12-31');
                    if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;

                    return (a.name || "").toLowerCase().localeCompare((b.name || "").toLowerCase());
                });

                projects = projectsData;

                // On lance le rendu UNIQUEMENT si les fonctions existent
                if (typeof renderGantt === 'function') {
                    renderGantt();
                    updateProjectSelector();
                }
            });
        }

        function updateProjectSelector() {
            const selector = document.getElementById('project-selector');
            if (!selector) return;

            let html = '<option value="">-- Nouveau Projet --</option>';

            projects.forEach(p => {
                // On définit une icône selon le statut
                let statusIcon = "🔵"; // En cours / Par défaut
                if (p.status === "Terminé") statusIcon = "✅";
                if (p.status === "À faire") statusIcon = "⚪";

                // On affiche le nom, le responsable et le statut
                html += `<option value="${p.id}">${statusIcon} ${p.name}</option>`;
            });

            selector.innerHTML = html;
        }

        function loadProjectInForm(id) {
            if (!id) {
                document.getElementById('p-id').value = '';
                document.getElementById('p-name').value = '';
                document.getElementById('p-progress').value = 0;
                document.getElementById('prog-val').innerText = "0%";
                document.getElementById('btn-delete').classList.add('hidden');
                return;
            }
            editProject(id);
        }

        function renderGantt(view = currentView) {
            currentView = view;
            const chartEl = document.getElementById('gantt-chart');
            if (!chartEl) return;

// --- 1. RÉCUPÉRATION DES FILTRES ---
    const filterOwnerVal = document.getElementById('filter-owner')?.value || 'all';
    const filterPriorityValue = document.getElementById('filter-priority')?.value || 'all';

    // Nouvelle logique pour les statuts multiples
    const selectedStatusElements = document.querySelectorAll('.status-filter:checked');
    const selectedStatuses = Array.from(selectedStatusElements).map(el => el.value);
    const selectedStatuses = Array.from(selectedStatusElements).map(el => el.value);

    // --- 2. FILTRAGE DES DONNÉES ---
    let filteredProjects = projects.filter(p => {
        const matchOwner = (filterOwnerVal === 'all' || p.owner === filterOwnerVal);
        const matchPriority = (filterPriorityValue === 'all' || (p.priority || "2") === filterPriorityValue);
        
        // On vérifie si le statut du projet est dans notre tableau de statuts cochés
        const matchStatus = selectedStatuses.includes(p.status || "À faire");

        return matchOwner && matchStatus && matchPriority;
    });


            // Si aucun projet ne correspond (Correction de la variable 'container' par 'chartEl')
            if (filteredProjects.length === 0) {
                chartEl.innerHTML = `<div class="p-20 text-center text-slate-400">Aucun projet ne correspond à ces critères.</div>`;
                return;
            }

            // --- 3. PRÉPARATION DES TÂCHES ---
            const tasks = filteredProjects.map(p => {
                const respoFound = responsables.find(r => r.id === p.owner);
                const displayName = respoFound ? respoFound.name : (p.owner || "Inconnu");

                const status = p.status || "À faire";
                const progress = p.progress || 0;
                const priority = p.priority || "2";

                // Définition de l'icône de statut
                let statusIcon = "🔵";
                if (status === "Terminé") statusIcon = "✅";
                if (status === "À faire") statusIcon = "⚪";

                // Définition du badge de priorité
                let prioBadge = "🟡 P2";
                if (priority === "1") prioBadge = "🔴 P1";
                if (priority === "3") prioBadge = "🔵 P3";

                // Définition de la classe CSS pour le style des barres
                let customClass = `priority-${priority}`;
                if (status === "Terminé") customClass = 'project-finished';

                return {
                    id: p.id,
                    // Format du nom : Priorité | Statut | Nom | Responsable | Progression
                    name: `${prioBadge} | ${status} | ${p.name} | ${displayName} | ${progress}%`,
                    start: p.start || new Date().toISOString().split('T')[0],
                    end: p.end || new Date().toISOString().split('T')[0],
                    progress: progress,
                    custom_class: customClass
                };
            });

            // --- 4. RENDU DU GANTT ---
            chartEl.innerHTML = ''; // Nettoyage du conteneur avant reconstruction

            gantt = new Gantt("#gantt-chart", tasks, {
                language: 'fr',
                view_mode: view,
                bar_height: 38,
                padding: 10,
                on_click: task => {
                    // Lien vers la page de détails des tâches
                    window.location.href = `liste_taches.html?id=${task.id}`;
                },
                on_date_change: (task, start, end) => {
                    if (typeof updateQuick === 'function') {
                        updateQuick(task.id, {
                            start: start.toISOString().split('T')[0],
                            end: end.toISOString().split('T')[0]
                        });
                    }
                },
                on_progress_change: (task, progress) => {
                    if (typeof updateQuick === 'function') {
                        updateQuick(task.id, { progress });
                    }
                }
            });

            // --- 5. PERSONNALISATION POST-RENDU (Couleurs et Édition) ---
            setTimeout(() => {
                filteredProjects.forEach(p => {
                    // Application de la couleur par responsable (ou gris si terminé)
                    const bar = document.querySelector(`[data-id="${p.id}"] .bar-progress`);
                    if (bar) {
                        const color = p.status === "Terminé" ? '#94a3b8' : getColor(p.owner);
                        bar.style.setProperty('fill', color, 'important');
                    }
                });

                // Gestion du clic sur les textes pour ouvrir la modale d'édition
                document.querySelectorAll('.gantt .grid-row text').forEach((el) => {
                    el.style.cursor = 'pointer';
                    el.onclick = (e) => {
                        e.stopPropagation();
                        const taskId = el.closest('.grid-row').getAttribute('data-id');
                        if (taskId) editProject(taskId);
                    };
                });
            }, 150);
        }


        async function updateQuick(id, data) {
            const user = auth.currentUser;
            const editorName = user ? (user.displayName || user.email) : "Système";

            const extendedData = {
                ...data,
                lastEditedBy: editorName,
                lastEditedAt: new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
            };

            await window.fbMethods.update(window.fbMethods.ref(window.fbDB, 'projects/' + id), extendedData);
            showStatus("SYNCHRO OK");
        }

        async function addOrUpdateProject() {
            try {
                const startVal = document.getElementById('p-start').value;
                const endVal = document.getElementById('p-end').value;

                // 1. Vérification des dates
                if (startVal && endVal && new Date(endVal) < new Date(startVal)) {
                    alert("Erreur de dates !");
                    return;
                }

                // 2. Récupération de l'utilisateur (via window.auth rendu global)
                const user = window.auth ? window.auth.currentUser : null;
                const editorName = user ? (user.displayName || user.email.split('@')[0]) : "Anonyme";

                const now = new Date();
                const dateString = now.toLocaleDateString('fr-FR') + " à " +
                    now.getHours() + "h" +
                    now.getMinutes().toString().padStart(2, '0');

                // 3. Préparation des données
                const id = document.getElementById('p-id').value || "ID-" + Date.now();
                const pData = {
                    id: id,
                    name: document.getElementById('p-name').value || "Projet sans nom",
                    owner: document.getElementById('p-owner').value,
                    status: document.getElementById('p-status').value,
                    priority: document.getElementById('p-priority').value,
                    start: startVal,
                    end: endVal,
                    progress: parseInt(document.getElementById('p-progress').value) || 0,
                    lastEditedBy: editorName,
                    lastEditedAt: dateString
                };

                // 4. Envoi à Firebase en utilisant window.fbMethods
                const fb = window.fbMethods;
                await fb.set(fb.ref(window.fbDB, 'projects/' + id), pData);

                // 5. Fermeture et succès
                closeForm();
                showStatus("ENREGISTRÉ");

            } catch (error) {
                console.error("Erreur détaillée :", error);
                alert("Erreur technique : " + error.message);
            }
        }

        async function deleteProject() {
            const id = document.getElementById('p-id').value;
            if (id && confirm("Supprimer ce projet ?")) {
                await window.fbMethods.remove(window.fbMethods.ref(window.fbDB, 'projects/' + id));
                closeForm();
                showStatus("EFFACÉ");
            }
        }

        function editProject(id) {
            // 1. Recherche du projet dans le tableau global
            const p = projects.find(i => i.id === id);
            if (!p) return;

            // 2. Remplissage des champs de texte et dates
            document.getElementById('p-id').value = p.id;
            document.getElementById('p-name').value = p.name || "";
            document.getElementById('p-owner').value = p.owner || "";
            document.getElementById('p-status').value = p.status || "À faire";
            document.getElementById('p-start').value = p.start || "";
            document.getElementById('p-end').value = p.end || "";

            // 3. Gestion de la progression (input + affichage texte)
            document.getElementById('p-progress').value = p.progress || 0;
            document.getElementById('prog-val').innerText = (p.progress || 0) + "%";

            // 4. GESTION DE LA PRIORITÉ (Valeur par défaut "2" si vide)
            document.getElementById('p-priority').value = p.priority || "2";

            // 5. INTERFACE ET SÉLECTEURS
            // Affiche le bouton supprimer
            const btnDelete = document.getElementById('btn-delete');
            if (btnDelete) btnDelete.classList.remove('hidden');

            // Mise à jour du sélecteur de projet (si présent dans ta modale)
            const projectSelector = document.getElementById('project-selector');
            if (projectSelector) projectSelector.value = p.id;

            // 6. LOGIQUE DE SUIVI DES MODIFICATIONS (Historique)
            const infoBox = document.getElementById('edit-info');
            const infoText = document.getElementById('last-edit-text');

            if (p.lastEditedBy && p.lastEditedAt) {
                if (infoBox) infoBox.classList.remove('hidden');
                if (infoText) infoText.innerText = `${p.lastEditedBy} le ${p.lastEditedAt}`;
            } else {
                if (infoBox) infoBox.classList.add('hidden');
            }

            // 7. OUVERTURE DE LA MODALE
            // On appelle ta fonction openForm et on assure la visibilité de l'overlay
            const overlay = document.getElementById('form-overlay');
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.classList.add('flex');
            }

            if (typeof openForm === 'function') {
                openForm(true); // true indique le mode édition
            }
        }

        function openForm(isEdit = false) {
            const overlay = document.getElementById('form-overlay');
            if (!overlay) return;

            // --- SÉCURITÉ : On réinitialise le style forcé ---
            overlay.style.display = ''; // On vide le style pour laisser le CSS (modal-active) piloter

            if (isEdit !== true) {
                document.getElementById('p-id').value = '';
                document.getElementById('p-name').value = '';
                document.getElementById('p-progress').value = 0;
                document.getElementById('prog-val').innerText = "0%";
                document.getElementById('btn-delete').classList.add('hidden');
                document.getElementById('project-selector').value = '';
            }

            // On active la modale
            overlay.classList.add('modal-active');
        }

        function closeForm() {
            const overlay = document.getElementById('form-overlay');

            if (overlay) {
                // 1. On retire les classes d'affichage de Tailwind
                overlay.classList.add('hidden');
                overlay.classList.remove('flex');

                // 2. FORCE : On s'assure via le style inline que c'est caché
                overlay.style.setProperty('display', 'none', 'important');
            }

            // 3. Nettoyage du formulaire (pour ne pas avoir les données du projet précédent au prochain clic)
            const form = document.getElementById('project-form');
            if (form) form.reset();

            // 4. On vide l'ID pour que le prochain "Ajout" soit bien considéré comme nouveau
            const idP = document.getElementById('p-id');
            if (idP) idP.value = "";
        }

        function changeView(v) { renderGantt(v); }

        function showStatus(txt) {
            const s = document.getElementById('save-status');
            s.innerText = "✅ " + txt; s.style.opacity = "1";
            setTimeout(() => s.style.opacity = "0", 3000);
        }

        document.getElementById('p-progress').oninput = function () {
            document.getElementById('prog-val').innerText = this.value + "%";
        };


        window.togglePasswordVisibility = function () {
            const passwordInput = document.getElementById('login-password');
            const eyeIcon = document.getElementById('eye-icon');

            if (passwordInput.type === 'password') {
                // Afficher le mot de passe
                passwordInput.type = 'text';
                // Changer l'icône (œil barré)
                eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.059 10.059 0 014.473-4.474M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 3.359a10.014 10.014 0 01-1.125 1.125m-1.513-1.513l-3.374-3.374m0 0l-1.125-1.125m1.125 1.125l3.374 3.374M9 4.612A9.965 9.965 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        `;
            } else {
                // Cacher le mot de passe
                passwordInput.type = 'password';
                // Remettre l'icône normale
                eyeIcon.innerHTML = `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        `;
            }
        };


        // Affiche la nouvelle modale au lieu du "confirm" par défaut
        function showDeleteConfirm() {
            document.getElementById('confirm-modal').classList.remove('hidden');
            document.getElementById('confirm-modal').classList.add('flex');
        }

        // Ferme la modale si on annule
        function closeDeleteConfirm() {
            document.getElementById('confirm-modal').classList.add('hidden');
            document.getElementById('confirm-modal').classList.remove('flex');
        }

        // Fonction qui exécute la suppression après clic sur le bouton rouge
        async function confirmDeleteProject() {
            const id = document.getElementById('p-id').value; // C'est l'ID du projet

            if (id) {
                try {
                    const { ref, remove } = window.fbMethods;

                    // 1. Supprimer le projet lui-même
                    await remove(ref(window.fbDB, 'projects/' + id));

                    // 2. Supprimer TOUTES les tâches liées à ce projet
                    // On cible le dossier 'tasks' qui porte le même ID que le projet
                    await remove(ref(window.fbDB, 'tasks/' + id));

                    // 3. Interface et retours
                    closeDeleteConfirm();
                    closeForm();
                    showStatus("PROJET & TÂCHES EFFACÉS");

                } catch (error) {
                    console.error("Erreur lors de la suppression :", error);
                    alert("Une erreur est survenue pendant la suppression.");
                }
            }
        }
        async function updateVersionDisplay() {
            try {
                // 1. Lire le contenu du fichier sw.js
                const response = await fetch('./sw.js');
                const text = await response.text();

                // 2. Utiliser une expression régulière pour trouver 'pilotage-v3.1.2'
                const match = text.match(/const\s+CACHE_NAME\s*=\s*['"]pilotage-v([^'"]+)['"]/);

                if (match && match[1]) {
                    const versionNumber = match[1]; // Récupère "3.1.2"
                    document.getElementById('app-version').innerText = `v${versionNumber}`;
                } else {
                    document.getElementById('app-version').innerText = 'v1.0.0';
                }
            } catch (e) {
                console.error("Erreur de récupération de la version:", e);
                document.getElementById('app-version').innerText = 'v--';
            }
        }



        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').then(reg => {
                // On écoute l'installation d'un nouveau Service Worker
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        // Dès que le nouveau SW est installé et prêt, on affiche le bouton
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            const banner = document.getElementById('update-banner');
                            if (banner) {
                                banner.classList.remove('hidden');
                            }
                        }
                    });
                });
            });
        }



        // Appeler la fonction au chargement de la page
        updateVersionDisplay();
