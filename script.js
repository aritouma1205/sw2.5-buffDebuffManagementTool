document.addEventListener('DOMContentLoaded', () => {
    let currentRound = 1;
    let characters = [];
    let definedEffects = [];
    let combatHistory = [];

    // DOM要素の取得
    const currentRoundSpan = document.getElementById('current-round');
    const prevRoundBtn = document.getElementById('prev-round-btn');
    const nextRoundBtn = document.getElementById('next-round-btn');
    const resetCombatBtn = document.getElementById('reset-combat-btn');

    const charactersContainer = document.getElementById('characters-container');
    const newCharacterNameInput = document.getElementById('new-character-name-input');
    const newCharacterFactionRadios = document.querySelectorAll('input[name="new_char_faction"]');
    const addCharacterBtn = document.getElementById('add-character-btn');

    const applyAllEffectBtn = document.getElementById('apply-all-effect-btn');
    const applyAllyEffectBtn = document.getElementById('apply-ally-effect-btn');
    const applyEnemyEffectBtn = document.getElementById('apply-enemy-effect-btn');
    const applyMultiTargetEffectBtn = document.getElementById('apply-multi-target-effect-btn');

    const copyCharacterEffectsBtn = document.getElementById('copy-character-effects-btn');

    const addEffectForm = document.getElementById('add-effect-form');
    const effectNameInput = document.getElementById('effect-name-input');
    const effectDurationInput = document.getElementById('effect-duration-input');
    const effectDescriptionInput = document.getElementById('effect-description-input');
    const effectTypeInput = document.getElementById('effect-type-input');
    const effectTargetRangeInput = document.getElementById('effect-target-range-input');

    // 定義済み効果リストのDOM要素をULに戻す
    const definedEffectsList = document.getElementById('defined-effects-list'); // UL要素を取得
    // 以前のドロップダウン・削除ボタンの取得は削除
    // const definedEffectsDropdown = document.getElementById('defined-effects-dropdown');
    // const deleteSelectedDefinedEffectBtn = document.getElementById('delete-selected-defined-effect-btn');


    // アコーディオン関連のDOM要素を取得
    const toggleDefinedEffectsBtn = document.getElementById('toggle-defined-effects-btn');
    const definedEffectsContent = document.getElementById('defined-effects-content');


    const applyEffectModal = document.getElementById('apply-effect-modal');
    const closeModalBtn = applyEffectModal.querySelector('.close-button');
    const modalCharName = document.getElementById('modal-char-name');
    const modalEffectSelect = document.getElementById('modal-effect-select');
    const modalEffectDuration = document.getElementById('modal-effect-duration');
    const modalApplyBtn = document.getElementById('modal-apply-btn');

    let currentApplyingCharId = null;
    let currentApplyingEffectRange = null;

    // --- データ永続化 (localStorage) ---
    function loadData() {
        const savedData = localStorage.getItem('sw25_combat_data');
        if (savedData) {
            const data = JSON.parse(savedData);
            currentRound = data.currentRound || 1;
            characters = (data.characters || []).map(char => ({
                ...char,
                isChecked: char.isChecked || false
            }));
            definedEffects = data.definedEffects || [];
            combatHistory = data.combatHistory || [];
        }
    }

    function saveData() {
        const dataToSave = {
            currentRound: currentRound,
            characters: characters,
            definedEffects: definedEffects,
            combatHistory: combatHistory
        };
        localStorage.setItem('sw25_combat_data', JSON.stringify(dataToSave));
    }

    // --- UI更新 ---
    function updateUI() {
        currentRoundSpan.textContent = currentRound;
        renderCharacters();
        renderDefinedEffects(); // ここもリストのレンダリングに変わります
        prevRoundBtn.disabled = combatHistory.length === 0;
        saveData();
    }

    // キャラクターリストのレンダリング (変更なし)
    function renderCharacters() {
        charactersContainer.innerHTML = '';
        if (characters.length === 0) {
            charactersContainer.innerHTML = '<p>キャラクターがいません。「キャラクターを追加」ボタンで追加してください。</p>';
        }

        const sortedCharacters = [...characters].sort((a, b) => {
            if (a.faction === 'ally' && b.faction === 'enemy') return -1;
            if (a.faction === 'enemy' && b.faction === 'ally') return 1;
            return 0;
        });

        sortedCharacters.forEach(char => {
            const charCard = document.createElement('div');
            charCard.className = `character-card character-faction-${char.faction}`;
            charCard.innerHTML = `
                <h3>
                    <input type="checkbox" class="character-checkbox" data-char-id="${char.id}" ${char.isChecked ? 'checked' : ''}>
                    ${char.name}
                    <span class="faction-indicator ${char.faction}">${char.faction === 'ally' ? '味方' : '敵'}</span>
                </h3>
                <h4>適用中の効果:</h4>
                <ul class="effect-list">
                    ${char.effects.length === 0 ? '<li>効果なし</li>' : char.effects.map(effect => `
                        <li class="effect-item effect-${effect.type}">
                            <span>${effect.name} (${effect.duration}R)</span>
                            <span class="effect-end-round">(終了予定: ${effect.endRound}R終了時)</span>
                            <p>${effect.description ? ` (${effect.description})` : ''}</p>
                            <button data-char-id="${char.id}" data-effect-instance-id="${effect.instanceId}" class="remove-effect-btn">解除</button>
                        </li>
                    `).join('')}
                </ul>
                <div class="character-card-buttons">
                    <button data-char-id="${char.id}" class="add-effect-to-char-btn">効果を追加</button>
                    <button data-char-id="${char.id}" class="remove-char-btn">キャラクターを削除</button>
                </div>
            `;
            charactersContainer.appendChild(charCard);
        });

        attachCharacterEventListeners();
    }

    // 定義済み効果リストのレンダリングをULリストに戻す
    function renderDefinedEffects() {
        definedEffectsList.innerHTML = ''; // UL要素をクリア

        if (definedEffects.length === 0) {
            definedEffectsList.innerHTML = '<li>定義済み効果がありません。</li>';
        } else {
            // 効果名でソートして表示
            const sortedDefinedEffects = [...definedEffects].sort((a, b) => a.name.localeCompare(b.name));

            sortedDefinedEffects.forEach(effect => {
                const effectItem = document.createElement('li');
                // リストアイテムの表示テキストも詳細に
                const targetRangeText = {
                    'single': '単体',
                    'all': '全体',
                    'all_ally': '味方全体',
                    'all_enemy': '敵全体'
                }[effect.targetRange] || '不明';

                effectItem.innerHTML = `
                    <span>${effect.name} (${effect.duration}R, ${effect.type}, ${targetRangeText}) ${effect.description ? ` - ${effect.description}` : ''}</span>
                    <button data-effect-id="${effect.id}" class="remove-defined-effect-btn">削除</button>
                `;
                definedEffectsList.appendChild(effectItem);
            });

            // 動的に生成された削除ボタンにイベントリスナーを再設定
            document.querySelectorAll('#defined-effects-list .remove-defined-effect-btn').forEach(button => {
                button.addEventListener('click', (event) => {
                    const effectId = event.target.dataset.effectId;
                    removeDefinedEffect(effectId);
                });
            });
        }
    }

    // キャラクターカード内のイベントリスナーをアタッチ (変更なし)
    function attachCharacterEventListeners() {
        document.querySelectorAll('.add-effect-to-char-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const charId = event.target.dataset.charId;
                openApplyEffectModal(charId, 'single');
            });
        });

        document.querySelectorAll('.remove-effect-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const charId = event.target.dataset.charId;
                const effectInstanceId = event.target.dataset.effectInstanceId;
                removeEffectFromCharacter(charId, effectInstanceId);
            });
        });

        document.querySelectorAll('.remove-char-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const charId = event.target.dataset.charId;
                if (confirm('このキャラクターを削除しますか？')) {
                    removeCharacter(charId);
                }
            });
        });

        document.querySelectorAll('.character-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (event) => {
                const charId = event.target.dataset.charId;
                const char = characters.find(c => c.id === charId);
                if (char) {
                    char.isChecked = event.target.checked;
                    saveData();
                }
            });
        });
    }

    // --- ラウンド管理ロジック (変更なし) ---
    nextRoundBtn.addEventListener('click', () => {
        characters.forEach(char => {
            const checkbox = document.querySelector(`.character-checkbox[data-char-id="${char.id}"]`);
            char.isChecked = checkbox ? checkbox.checked : false;
        });

        combatHistory.push({
            round: currentRound,
            charactersState: JSON.parse(JSON.stringify(characters))
        });

        currentRound++;
        characters.forEach(char => {
            char.effects = char.effects.filter(effect => currentRound <= effect.endRound);
        });
        updateUI();
    });

    prevRoundBtn.addEventListener('click', () => {
        if (combatHistory.length > 0) {
            const prevState = combatHistory.pop();
            currentRound = prevState.round;
            characters = JSON.parse(JSON.stringify(prevState.charactersState));
            updateUI();
        } else {
            alert('これ以上前のラウンドには戻れません。');
        }
    });

    resetCombatBtn.addEventListener('click', () => {
        if (confirm('戦闘をリセットし、1ラウンド目に戻します。すべてのバフ・デバフ効果は解除され、履歴も消去されますが、キャラクターや定義済み効果は維持されます。よろしいですか？')) {
            currentRound = 1;
            characters.forEach(char => {
                char.effects = [];
                char.isChecked = false;
            });
            combatHistory = [];
            updateUI();
        }
    });

    // --- キャラクター管理 (変更なし) ---
    addCharacterBtn.addEventListener('click', () => {
        const newCharName = newCharacterNameInput.value.trim();
        let newCharFaction = 'ally';
        newCharacterFactionRadios.forEach(radio => {
            if (radio.checked) {
                newCharFaction = radio.value;
            }
        });

        if (newCharName !== '') {
            const newChar = {
                id: Date.now().toString(),
                name: newCharName,
                faction: newCharFaction,
                effects: [],
                isChecked: false
            };
            characters.push(newChar);
            updateUI();
            newCharacterNameInput.value = '';
            document.querySelector('input[name="new_char_faction"][value="ally"]').checked = true;
        } else {
            alert('キャラクター名を入力してください。');
        }
    });

    function removeCharacter(charId) {
        characters = characters.filter(c => c.id !== charId);
        updateUI();
    }

    // --- カスタム効果の定義 (変更なし) ---
    addEffectForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const name = effectNameInput.value.trim();
        const duration = parseInt(effectDurationInput.value, 10);
        const description = effectDescriptionInput.value.trim();
        const type = effectTypeInput.value;
        const targetRange = effectTargetRangeInput.value;

        if (name && !isNaN(duration) && duration > 0) {
            const newEffect = {
                id: Date.now().toString(),
                name: name,
                duration: duration,
                description: description,
                type: type,
                targetRange: targetRange
            };
            definedEffects.push(newEffect);
            updateUI();
            addEffectForm.reset();
        } else {
            alert('効果名、有効な効果時間、および適用範囲を入力してください。');
        }
    });

    // --- 定義済み効果の削除機能 (ULリストの個別ボタンに対応) ---
    function removeDefinedEffect(effectId) {
        if (confirm('この定義済み効果を削除しますか？')) {
            definedEffects = definedEffects.filter(effect => effect.id !== effectId);
            characters.forEach(char => {
                char.effects = char.effects.filter(effectInstance => effectInstance.id !== effectId);
            });
            updateUI();
        }
    }


    // --- アコーディオン機能の追加 (変更なし) ---
    toggleDefinedEffectsBtn.addEventListener('click', () => {
        const isExpanded = definedEffectsContent.classList.toggle('expanded');
        toggleDefinedEffectsBtn.classList.toggle('expanded', isExpanded);
        // ボタンのテキストを更新
        toggleDefinedEffectsBtn.textContent = isExpanded ? '定義済み効果リスト ▲' : '定義済み効果リスト ▼';

        // アコーディオンが開くとき、スクロールバーが最初から表示されないようにコンテンツの最大高さを調整
        if (isExpanded) {
            // コンテンツの高さが確定してからmax-heightを設定するとよりスムーズ
            // ただし、今回はシンプルに固定値を増やす
            definedEffectsContent.style.maxHeight = definedEffectsContent.scrollHeight + "px"; // コンテンツの実際の高さに合わせる
        } else {
            definedEffectsContent.style.maxHeight = "0";
        }
    });


    // --- 新しい全体適用ボタンのイベントリスナー (変更なし) ---
    applyAllEffectBtn.addEventListener('click', () => {
        openApplyEffectModal(null, 'all');
    });

    applyAllyEffectBtn.addEventListener('click', () => {
        openApplyEffectModal(null, 'all_ally');
    });

    applyEnemyEffectBtn.addEventListener('click', () => {
        openApplyEffectModal(null, 'all_enemy');
    });

    applyMultiTargetEffectBtn.addEventListener('click', () => {
        const checkedCharacters = characters.filter(char => {
            return char.isChecked;
        });

        if (checkedCharacters.length === 0) {
            alert('効果を適用するキャラクターをチェックボックスで選択してください。');
            return;
        }

        openApplyEffectModal(null, 'multi_target');
    });


    // --- コピーボタンのイベントリスナーと関数の修正 (変更なし) ---
    copyCharacterEffectsBtn.addEventListener('click', () => {
        const textToCopy = generateCharacterEffectsText();
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                alert('キャラクター効果がクリップボードにコピーされました！');
            })
            .catch(err => {
                console.error('クリップボードへのコピーに失敗しました:', err);
                alert('クリップボードへのコピーに失敗しました。ブラウザのコンソールを確認してください。');
            });
    });

    function generateCharacterEffectsText() {
        let lines = [];
        characters.forEach(char => {
            const activeEffects = char.effects.filter(effect => currentRound <= effect.endRound);

            if (activeEffects.length === 0) {
                return;
            }

            let allSubEffects = [];
            activeEffects.forEach(effect => {
                const subDescriptions = effect.description.split('\n')
                    .map(line => line.trim())
                    .filter(line => line !== '');

                if (subDescriptions.length > 0) {
                    allSubEffects.push(...subDescriptions);
                } else {
                    allSubEffects.push(effect.name.trim());
                }
            });

            const sortedSubEffects = allSubEffects.sort((a, b) => {
                const getBaseNameForSort = (text) => {
                    const match = text.match(/^(.*?)([+-]?\d+)$/);
                    return match ? match[1].trim() : text.trim();
                };

                const baseNameA = getBaseNameForSort(a);
                const baseNameB = getBaseNameForSort(b);

                const nameCompare = baseNameA.localeCompare(baseNameB);
                if (nameCompare !== 0) {
                    return nameCompare;
                }

                return a.localeCompare(b);
            });

            if (sortedSubEffects.length > 0) {
                lines.push(`${char.name}:${sortedSubEffects.join('、')}`);
            }
        });
        return lines.join('\n');
    }


    // --- キャラクターへの効果適用モーダル (変更なし) ---
    function openApplyEffectModal(charId, applyRangeType = 'single') {
        currentApplyingCharId = charId;
        currentApplyingEffectRange = applyRangeType;

        const char = characters.find(c => c.id === charId);
        let modalTitle = '効果を適用';
        if (applyRangeType === 'single' && char) {
            modalTitle = `${char.name} に効果を適用`;
        } else if (applyRangeType === 'all') {
            modalTitle = '全体効果を適用';
        } else if (applyRangeType === 'all_ally') {
            modalTitle = '味方全体に効果を適用';
        } else if (applyRangeType === 'all_enemy') {
            modalTitle = '敵全体に効果を適用';
        } else if (applyRangeType === 'multi_target') {
            modalTitle = '複数対象に効果を適用';
        }
        modalCharName.textContent = modalTitle;

        modalEffectSelect.innerHTML = '';

        const filteredDefinedEffects = definedEffects.filter(effect => {
            if (applyRangeType === 'single' || applyRangeType === 'multi_target') {
                return effect.targetRange === 'single';
            } else if (applyRangeType === 'all') {
                return effect.targetRange === 'all';
            } else if (applyRangeType === 'all_ally') {
                return effect.targetRange === 'all_ally';
            } else if (applyRangeType === 'all_enemy') {
                return effect.targetRange === 'all_enemy';
            }
            return true;
        });

        if (filteredDefinedEffects.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = '選択可能な効果がありません';
            option.disabled = true;
            modalEffectSelect.appendChild(option);
            modalApplyBtn.disabled = true;
        } else {
            filteredDefinedEffects.forEach(effect => {
                const option = document.createElement('option');
                option.value = effect.id;
                const targetRangeText = {
                    'single': '単体',
                    'all': '全体',
                    'all_ally': '味方全体',
                    'all_enemy': '敵全体'
                }[effect.targetRange] || '不明';
                option.textContent = `${effect.name} (${effect.duration}R, ${effect.type}, ${targetRangeText}) ${effect.description ? ` - ${effect.description}` : ''}`;
                modalEffectSelect.appendChild(option);
            });
            modalApplyBtn.disabled = false;
            if (filteredDefinedEffects.length > 0) {
                modalEffectSelect.value = filteredDefinedEffects[0].id;
                modalEffectDuration.value = filteredDefinedEffects[0].duration;
            } else {
                modalEffectDuration.value = "";
            }
        }

        applyEffectModal.style.display = 'block';

        modalEffectSelect.onchange = () => {
            const selectedEffect = filteredDefinedEffects.find(eff => eff.id === modalEffectSelect.value);
            if (selectedEffect) {
                modalEffectDuration.value = selectedEffect.duration;
            }
        };
    }

    closeModalBtn.addEventListener('click', () => {
        applyEffectModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === applyEffectModal) {
            applyEffectModal.style.display = 'none';
        }
    });

    modalApplyBtn.addEventListener('click', () => {
        const selectedEffectId = modalEffectSelect.value;
        const duration = parseInt(modalEffectDuration.value, 10);

        if (!selectedEffectId || isNaN(duration) || duration <= 0) {
            alert('効果を選択し、有効な残りラウンド数を入力してください。');
            return;
        }

        const definedEffect = definedEffects.find(eff => eff.id === selectedEffectId);
        if (!definedEffect) return;

        let targetCharacters = [];
        if (currentApplyingEffectRange === 'single') {
            const targetChar = characters.find(char => char.id === currentApplyingCharId);
            if (targetChar) targetCharacters.push(targetChar);
        } else if (currentApplyingEffectRange === 'all') {
            targetCharacters = characters;
        } else if (currentApplyingEffectRange === 'all_ally') {
            targetCharacters = characters.filter(char => char.faction === 'ally');
        } else if (currentApplyingEffectRange === 'all_enemy') {
            targetCharacters = characters.filter(char => char.faction === 'enemy');
        } else if (currentApplyingEffectRange === 'multi_target') {
            targetCharacters = characters.filter(char => char.isChecked);

            targetCharacters.forEach(char => {
                char.isChecked = false;
                const checkbox = document.querySelector(`.character-checkbox[data-char-id="${char.id}"]`);
                if (checkbox) checkbox.checked = false;
            });
        }

        targetCharacters.forEach(char => {
            applyEffectToCharacter(char.id, definedEffect, duration);
        });

        updateUI();
        applyEffectModal.style.display = 'none';
    });

    function applyEffectToCharacter(charId, effectDefinition, duration) {
        const char = characters.find(c => c.id === charId);
        if (char) {
            const newEffectInstance = {
                ...effectDefinition,
                instanceId: Date.now().toString(),
                duration: duration,
                endRound: currentRound + duration - 1
            };
            char.effects.push(newEffectInstance);
        }
    }

    function removeEffectFromCharacter(charId, effectInstanceId) {
        const char = characters.find(c => c.id === charId);
        if (char) {
            char.effects = char.effects.filter(effect => effect.instanceId !== effectInstanceId);
            updateUI();
        }
    }

    // --- 初期化処理 ---
    loadData();
    updateUI();
});