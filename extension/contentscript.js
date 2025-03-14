var contestants = { };
var categories = [ ];
var clues = [ ];
var currentClueIndex = -1;
var activeNum = 0, userAnswerNum = 0;
var wantUpperClues = false;
var jDiv, djDiv, fjDiv, scoresDiv, clueDiv, helpDiv;
var smallDropShadow = '2px 2px 2px black';
var bigDropShadow = '4px 4px 2px black';
var game_id = 0;

var responseTweaks = {
    game_174_clue_J_2_1:  [ /^(?!\.\.\.)/, '...<br>' ],
    game_179_clue_DJ_2_5: [ /$/, '<br>...<br>...<br>' ],
    game_180_clue_DJ_1_3: [ /$/, '<br>...<br>' ],
    game_340_clue_DJ_2_1: [ /$/, '<br>...<br>...<br>' ],
    game_344_clue_J_1_3:  [ /$/, '<br>...<br>...<br>' ],
    game_348_clue_J_6_3:  [ /^(?!\.\.\.)/, '...<br>' ],
    game_352_clue_J_6_4:  [ /[Tt]he Sunshine State\?/g, '[*]?' ],
    // This clue was corrected to get an earlier ... inserted, but the later ... was removed.  Sigh.
    game_353_clue_DJ_4_5: [ /(phrasing\]\.\)<br>)(?!\.\.\.)/, '$1(Mark: What is [*]?)<br>...<br>' ],
    // Note that ... adding below is needed due to clue already having one ... (but needing 2).
    game_355_clue_DJ_1_2: [ '(Richard: Let\'s go to EUROPE for $400.)<br>', /$/, '<br>...<br>' ],
    game_361_clue_J_5_2:  [ /^(?!\.\.\.)/, '...<br>' ],
    game_362_clue_DJ_3_5: [ /^(?!\.\.\.)/, '<RESPONSE>' ],
    game_363_clue_J_5_4:  [ /^(?!\.\.\.)/, '...<br>' ],
    game_1309_clue_J_4_4: [ /^(?!\.\.\.)/, '<RESPONSE>' ],
    game_1309_clue_J_1_3: [ /^(?!\.\.\.)/, '...<br>' ],
    game_1309_clue_DJ_6_4:[ /(Yippies\?\))/, '$1<br>...' ],
    game_3973_clue_J_3_2: [ /(\(Veronica)/, '<RESPONSE>$1', /(DeGeneres.\))/, '$1<br>(We were looking for [*].)' ],
    game_3975_clue_DJ_3_4:[ /$/, '<br>...<br>' ],
    game_3979_clue_DJ_1_5:[ /$/, '<br>...<br>' ],
    game_4113_clue_J_3_2: [ /$/, '<br>...<br>...<br>' ],
    game_4134_clue_J_5_5: [ /$/, '<br>...<br>' ],
    game_4535_clue_DJ_2_3:[ /\.\.\. I/, 'I' ],
};

function initialize()
{
    let title_el = document.getElementById('game_title');
    let content_el = document.getElementById('content');
    let comments_el = document.getElementById('game_comments');
    let j_el = document.getElementById('jeopardy_round');
    let dj_el = document.getElementById('double_jeopardy_round');
    let fj_el = document.getElementById('final_jeopardy_round');
    if (!content_el || !comments_el || !j_el)
        return;

    let m = location.search.match(/game_id=(\d+)/);
    if (m)
        game_id = m[1];

    let info = [ ], nicknames = [ ];
    document.querySelectorAll('p.contestants').forEach(function(el) {
        info.unshift(el.innerText);
    });
    document.querySelectorAll('td.score_player_nickname').forEach(function(el) {
        nicknames.push(el.innerText);
    });
    for (let j = 0; j < 3; j++) {
        contestants[nicknames[j]] = { info: info[j] };
    }

    document.querySelectorAll('td.category').forEach(function(el) {
        categories.push(el.firstElementChild);
    });

    let amount_re = /\$*([\d,]+)/;
    let lowest_value;

    document.querySelectorAll('td.clue_text').forEach(function(el) {
        let stuck_el = document.getElementById(el.id + '_stuck');
        if (!stuck_el)
            return;

        let val_el = stuck_el.nextElementSibling;
        let order_el = val_el ? val_el.nextElementSibling : null;
        let dd = val_el ? val_el.innerText.match(/DD:/) : null;

        if (dd || !lowest_value) {
            let j = dd ? 0 : el.id.substr(-1, 1);
            if (dd || j == 1) {
                let m = amount_re.exec(val_el.innerText);
                let value = parseInt(m[1].replace(/\D+/g, ''), 10);
                if (dd)
                    dd = value;
                else
                    lowest_value = value;
            }
        }

        let num = order_el ? parseInt(order_el.innerText, 10) : 61;
        if (el.id.match(/DJ/))
            num += 30;
        else if (el.id.match(/TB/))
            num += 1;

        let trigger;
        if (order_el) {
            trigger = stuck_el;
            while (trigger.nodeName != 'DIV')
                trigger = trigger.parentElement;
        } else
            trigger = categories[num - 61 + 12];

        clues[num] = {
            id: el.id,
            trigger: trigger,
            response: null,
            scores: { Your_Coryat: 0 },
            done: 0
        };
        if (dd)
            clues[num].dd_wager = dd;
    });

    for (let j = 1; j <= 63; j++) {
        if (!clues[j])
            clues[j] = { done: -1 };
    }

    createButtons(comments_el, dj_el, fj_el);

    helpDiv = createHelp(comments_el);

    jDiv = createBoard(comments_el, j_el, lowest_value, 0);
    if (dj_el)
        djDiv = createBoard(comments_el, dj_el, lowest_value*2, 6);

    if (fj_el)
        fjDiv = createFinalJeopardy(comments_el, fj_el);

    scoresDiv = createScores(comments_el, nicknames);

    createCluePopup();

    document.addEventListener('keydown', function(e) {
        if (document.activeElement) {
            let tn = document.activeElement.tagName;
            if (tn == 'INPUT' || tn == 'TEXTAREA')
                return true;
        }
        if (e.isComposing || e.keyCode === 229)
            return true;
        if (e.ctrlKey || e.altKey)
            return true;
        switch (e.key) {
          case ' ':
          case 'ArrowRight':
          case 'ArrowDown':
            if (currentClueIndex < 0)
                return true;
            goForward(e.key == 'ArrowDown' ? 1 : 0); // skip on down-arrow
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            if (currentClueIndex < 0)
                return true;
            goBackward(e.keyCode == 38 ? 1 : 0); // skip on up-arrow
            break;
          case 'y':
          case '+':
          case '=':
            if (currentClueIndex < 0)
                return true;
            noteUserAnswer(1);
            break;
          case 'n':
          case '-':
            if (currentClueIndex < 0)
                return true;
            noteUserAnswer(-1);
            break;
          case '0':
            if (currentClueIndex < 0)
                return true;
            noteUserAnswer(0);
            break;
          case 'Escape':
            if (currentClueIndex < 0)
                return true;
            if (activeNum) {
                goBackward(1);
                break;
            }
            return true;
          case 'g':
            startJeopardy(0);
            break;
          case 'u':
            toggleUpperClues();
            break;
          case 'h':
            toggleHelp();
            break;
          case '1':
            startJeopardy(1);
            break;
          case '2':
            startJeopardy(31);
            break;
          case '3':
            startJeopardy(61);
            break
          default:
            //console.log(e.key + "\n");
            return true;
        }
        e.preventDefault();
        return false;
    });

    window.addEventListener('resize', function() {
        if (clueDiv)
            clueDiv.needResize = 1;
    });

    setTimeout(function() { delayedInit(); }, 50);
}

function toggleUpperClues()
{
    wantUpperClues = !wantUpperClues;
    if (activeNum)
        displayClueScreen(0);
}

function toggleHelp()
{
    helpDiv.style.display = helpDiv.style.display == 'none' ? 'block' : 'none';
    clueDiv.needResize = 1;
    if (activeNum)
        checkClueResize();
}

function startJeopardy(num)
{
    let want_new = num || currentClueIndex < 0;
    let display_new = want_new ? 'block' : 'none';
    let display_old = want_new ? 'none' : 'block';

    let j_el = document.getElementById('jeopardy_round');
    let dj_el = document.getElementById('double_jeopardy_round');
    let fj_el = document.getElementById('final_jeopardy_round');

    jDiv.style.display = display_new;
    if (djDiv)
        djDiv.style.display = 'none';
    if (fjDiv)
        fjDiv.style.display = 'none';
    scoresDiv.style.display = display_new;
    clueDiv.style.display = 'none';

    j_el.style.display = display_old;
    if (dj_el)
        dj_el.style.display = display_old;
    if (fj_el)
        fj_el.style.display = display_old;

    if (num) {
        if (currentClueIndex < 0)
            currentClueIndex *= -1;

        // Make sure no later clues are "done".
        for (let j = 62; j >= num; j--) {
            let clue = clues[j];
            if (clue.done < 0)
                continue;
            let el = document.getElementById(clue.id + '_new');
            el.style.color = 'gold';
            el.style.textShadow = bigDropShadow;
            el.style.borderColor = j == num ? 'red' : 'black';
            clue.done = 0;
        }

        for (let who in contestants) {
            let adjust_el = contestants[who].adjust_el;
            adjust_el.innerHTML = '&nbsp;';
            if (who == 'Your_Coryat')
                continue;
            let score_el = contestants[who].score_el;
            score_el.className = 'score_positive';
            score_el.innerHTML = '$0';
            score_el.value = 0;
        }

        for (let j = 1; j < num; j++) {
            let clue = clues[j];
            if (clue.done < 0)
                continue;
            let el = document.getElementById(clue.id + '_new');
            el.style.color = '#0000AF';
            el.style.textShadow = 'none';
            el.style.borderColor = 'black';
            clue.done = 2;
            finishClueParsing(clue);
            for (let who in contestants) {
                if (who == 'Your_Coryat')
                    continue;
                if (clue.scores[who])
                    contestants[who].score_el.value += clue.scores[who];
            }
        }

        for (let who in contestants)
            adjustOneScore(who, 0, 1);

        currentClueIndex = num;
        clueDiv.needResize = 1;

        if (activeNum)
            hideClue();
        checkActiveBoard();
    } else {
        currentClueIndex *= -1;
        if (want_new) {
            checkActiveBoard();
            if (activeNum)
                clueDiv.style.display = 'block';
        }
    }
}

function createBoard(containing_el, old_el, lowest_value, category_ndx)
{
    let div_el = document.createElement('div');
    div_el.appendChild(old_el.firstElementChild.cloneNode(true));
    div_el.style.display = 'none';

    let tbl_el = document.createElement('table');
    tbl_el.id = old_el.id + '_new';
    tbl_el.className = 'round pLaYgoldBorder';

    let r = tbl_el.insertRow(0);
    for (let j = 0; j < 6; j++) {
        let c = r.insertCell(j);
        c.className = 'category';
        c.style.textShadow = smallDropShadow;
        c.style.borderColor = 'black';
        c.appendChild(categories[j+category_ndx].cloneNode(true));
    }

    let letter = category_ndx ? 'DJ' : 'J';
    for (let i = 1; i <= 5; i++) {
        let r = tbl_el.insertRow(i);
        for (let j = 1; j <= 6; j++) {
            let c = r.insertCell(j - 1);
            c.id = 'clue_' + letter + '_' + j + '_' + i + '_new';
            c.style.color = 'black';
            c.style.borderColor = 'black';
            c.value = i * lowest_value;
            c.className = c.value >= 1000 ? 'clue pLaYnum pLaYbignum' : 'clue pLaYnum';
	    // edit start
	    let s = document.createElement('span');
	    s.setAttribute("class", "pLaYdollar");
	    s.innerText = '$';
	    let t = document.createTextNode(c.value);
	    c.appendChild(s);
	    c.appendChild(t);
	    // edit end
            c.onclick = function() { toggleClue(this, this.num, 0); return false; };
        }
    }

    div_el.appendChild(tbl_el);
    containing_el.appendChild(div_el);

    return div_el;
}

function createFinalJeopardy(containing_el, old_el)
{
    let div_el = document.createElement('div');
    div_el.appendChild(old_el.firstElementChild.cloneNode(true));
    div_el.style.display = 'none';

    let tbl_el = document.createElement('table');
    tbl_el.id = 'final_jeopardy_round_new';
    tbl_el.className = 'round pLaYgoldBorder';

    let want_col = [ ];
    want_col[3] = 1;
    if (categories.length > 13)
        want_col[4] = 1;

    let r = tbl_el.insertRow(0);
    for (let j = 1; j <= 6; j++) {
        let c = r.insertCell(j - 1);
        c.className = 'category';
        c.style.borderColor = 'black';
        if (want_col[j])
            c.appendChild(categories[j - 3 + 12].cloneNode(true));
        else
            c.innerHTML = '&nbsp;'
    }

    for (let i = 1; i <= 5; i++) {
        let r = tbl_el.insertRow(i);
        for (let j = 1; j <= 6; j++) {
            let c = r.insertCell(j - 1);
            if (i == 1 && want_col[j]) {
                c.id = j == 3 ? 'clue_FJ_new' : 'clue_TB_new';
                c.num = j == 3 ? 61 : 62;
                c.className = 'clue pLaYfinal';
		// edit start
		if (j == 3) {
		    c.innerHTML = 'FINAL<br><small>JEOPARDY</small>';
		} else {
		    c.innerHTML = 'TIE<br><small>BREAKER</small>';
		}
		// edit end
                c.onclick = function() { toggleClue(this, this.num, 0); return false; };
            } else {
                c.className = 'clue pLaYnum';
                c.innerHTML = '&nbsp;';
            }
            c.style.borderColor = 'black';
        }
    }

    div_el.appendChild(tbl_el);
    containing_el.appendChild(div_el);

    let clue = clues[61];
    clue.fj_order = [ ];
    clue.response = { };
    clue.scores = { Combo_Coryat: 0 };
    clue.query = tweakClue(document.getElementById(clue.id).innerHTML);

    let m = document.getElementById(clue.id + '_r').innerHTML.match(/^(.*)(<table.+)$/);
    clue.banter = m[1];
    let response = m[2];

    m = response.match(/class="correct_response">(.*?)<\/em>/);
    clue.correct_response = m[1];

    let ans_re = /"(right|wrong)">(.*?)<\/td><td .*?>(.*?)<\/td><\/tr><tr><td>\$([\d,]+)</g;
    while ((m = ans_re.exec(response)) !== null) {
        let right = m[1] == 'right' ? 1 : 0;
        let who = m[2];
        let repl = m[3];
        let wager = parseInt(m[4].replace(/,/g, ''), 10);
        let correctness = right ? 'correct!' : "Sorry, that's wrong.";
        let html = '<p>' + who + ': ' + repl + '<p>' + correctness
                 + '<p>Your wager? ' + prettyDollars(wager, '$');
        clue.fj_order.push({ who: who, right: right });
        clue.response[who] = html;
        clue.scores[who] = wager * (right ? 1 : -1);
    }

    if (clue.banter)
        clue.banter = clue.banter.replace(/\[\*\]/g, '<em class="correct_response">' + clue.correct_response + '</em>');

    return div_el;
}

function createScores(containing_el, nicknames)
{
    let div_el = document.createElement('div');
    div_el.innerHTML = '<br>';
    div_el.style.display = 'none';

    let tbl_el = document.createElement('table');
    tbl_el.id = 'scores_new';
    tbl_el.align = 'center';

    // edit start
    // nicknames[3] = '\u00a0';
    // nicknames[4] = 'Combo\r\nCoryat';
    // nicknames[5] = 'Your\r\nCoryat';
    nicknames[3] = '&nbsp;';
    nicknames[4] = 'Combo<br>Coryat';
    nicknames[5] = 'Your<br>Coryat';
    // edit end
    contestants['Combo_Coryat'] = { };
    contestants['Your_Coryat'] = { };

    let r = tbl_el.insertRow(0);
    r.align = 'center';
    for (let j = 0; j < 7; j++) {
        let c = r.insertCell(j);
        if (j == 6) {
            c.innerHTML = '<a href="javascript:" id="my_undo" title="You did not answer">&#9003;</a>';
            continue;
        }
        if (j != 3) {
            let who = nicknames[j].replace(/<br>/g, '_');
            c.id = 'adjust_' + who;
            contestants[who].adjust_el = c;
        }
        c.innerHTML = '&nbsp;'
    }

    r = tbl_el.insertRow(1);
    for (let j = 0; j < 7; j++) {
        let c = r.insertCell(j);
        if (j == 3) {
            c.innerHTML = '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;';
        } else if (j != 6) {
            let who = nicknames[j].replace(/<br>/g, '_');
            c.id = 'score_' + who;
            contestants[who].score_el = c;
            c.className = 'score_positive';
            c.style.borderWidth = '2px';
            c.style.borderStyle = 'solid';
            c.style.borderColor = 'grey';
            c.innerHTML = '$0';
            c.value = 0;
        }
    }

    r = tbl_el.insertRow(2);
    for (let j = 0; j < 7; j++) {
        let c = r.insertCell(j);
        c.vAlign = 'middle';
        if (j == 6) {
            c.className = 'pLaYmyBtn';
            c.innerHTML = '<a href="javascript:" id="my_yes" title="You got it right">&#9989;</a><br><br>'
                        + '<a href="javascript:" id="my_no" title="You got it wrong">&#10060;</a>';
            continue;
        }
        if (j != 3) {
            c.className = 'clue pLaYname';
            c.style.fontSize = j < 3 ? '3em' : '2em';
            c.style.textShadow = bigDropShadow;
        } else
            c.style.fontSize = '3em';
	// edit start
	if (j < 3) {
            c.innerText = nicknames[j];
	} else if (j == 3) {
	    c.innerHTML = '&nbsp;';
	} else if (j == 4) {
	    c.innerHTML = 'Combo<br>Coryat';
	} else if (j == 5) {
	    c.innerHTML = 'Your<br>Coryat';
	}
	// edit end
    }
    r = tbl_el.insertRow(3);
    for (let j = 0; j < 6; j++) {
        let c = r.insertCell(j);
        c.innerHTML = '&nbsp;';
    }

    div_el.appendChild(tbl_el);
    containing_el.appendChild(div_el);

    return div_el;
}

function createButtons(containing_el, dj_el, fj_el)
{
    let div_el = document.createElement('div');
    // edit start
    if (dj_el) {
	if (fj_el) {
	    div_el.innerHTML = '<br><table align="center" valign="middle"><tr><td>'
             + '<button id="toggle_btn">Toggle game style</button>'
             + '<button id="J_btn">Start Jeopardy!</button>'
	     + '<button id="DJ_btn">Start Double Jeopardy!</button>'
	     + '<button id="FJ_btn">Start Final Jeopardy!</button>'
	     + '<button id="upper_btn">Toggle uppercase clues</button>'
	     + '<button id="help_btn">Show/Hide help</button>'
	     + '</td></tr></table>';
	} else {
	    div_el.innerHTML = '<br><table align="center" valign="middle"><tr><td>'
             + '<button id="toggle_btn">Toggle game style</button>'
             + '<button id="J_btn">Start Jeopardy!</button>'
	     + '<button id="DJ_btn">Start Double Jeopardy!</button>'
	     + '<button id="upper_btn">Toggle uppercase clues</button>'
	     + '<button id="help_btn">Show/Hide help</button>'
	     + '</td></tr></table>';
	}
    } else {
        div_el.innerHTML = '<br><table align="center" valign="middle"><tr><td>'
             + '<button id="toggle_btn">Toggle game style</button>'
             + '<button id="J_btn">Start Jeopardy!</button>'
	     + '<button id="upper_btn">Toggle uppercase clues</button>'
	     + '<button id="help_btn">Show/Hide help</button>'
	     + '</td></tr></table>';
    }
    // edit end

    containing_el.appendChild(div_el);

    return div_el;
}

function createHelp(containing_el)
{
    let div_el = document.createElement('div');
    div_el.style.display = 'none';
    div_el.innerHTML = '<table style="background-color: #0000AF; font-size: 1.3em; border: 2px gold solid" width="700" align="center"><tr><td align="left">'
        + "The j-play extension has added the above buttons to allow you to play along with an archived Jeopardy! game. "
        + "To get going, press one of the 'Start' (or 'Toggle') buttons and you will see one clue with a highlighted red border -- that clue is the one that is next in the broadcast order. "
        + "If you press the <span class='pLaYkey'>Spacebar</span> or the <span class='pLaYkey'>Right-Arrow</span> key, it will advance to the next screen for the current clue or to the next clue. "
        + "It is also possible to choose clues by clicking on them (allowing you to see clues in whatever order you like) and to click inside the displayed clue to advance to the next clue screen. "
        + "<br><br>"
        + "A running score will be kept, which shows how the contestants' scores are affected by the just-seen responses. "
        + "If you want to keep your own score (using Coryat scoring) you can press <span class='pLaYkey'>y</span> or <span class='pLaYkey'>+</span> when viewing an answer to indicate that you got the question right, or <span class='pLaYkey'>n</span> or <span class='pLaYkey'>-</span> to indicate that you got it wrong. "
        + "If you chose not to answer, you don't need to press anything (though you can press <span class='pLaYkey'>0</span> (zero) to clear your score for the just-revealed clue, if you need to). "
        + "There are also &#9989; &#10060; &#9003; buttons at the bottom that you can click instead. "
        + "<br><br>"
        + '<table border=1 align="center">'
        + "<tr><th>Key</th><th>Action</th>"
        + "<tr><td class='pLaYkey'>Space <span class='pLaYnonKey'>and</span> Right-Arrow</td><td>Go forward to next clue screen or next clue</td></tr>"
        + "<tr><td class='pLaYkey'>Left-Arrow</td><td>Backup a screen in a clue or backup a clue</td></tr>"
        + "<tr><td class='pLaYkey'>Up-Arrow</td><td>Backup a clue (skips clue screens)</td></tr>"
        + "<tr><td class='pLaYkey'>Down-Arrow</td><td>Go forward a clue (skips clue screens)</td></tr>"
        + "<tr><td class='pLaYkey'>y <span class='pLaYnonKey'>and</span> +</td><td>Score that you correctly answered the current clue</td></tr>"
        + "<tr><td class='pLaYkey'>n <span class='pLaYnonKey'>and</span> -</td><td>Score that you incorrectly answered the current clue</td></tr>"
        + "<tr><td class='pLaYkey'><span class='pLaYnonKey' style='color: #0000AF'>(zero)</span> 0 <span class='pLaYnonKey'>(zero)</span></td><td>Clear your score for the current clue</td></tr>"
        + "<tr><td class='pLaYkey'>g</td><td>Toggle game style between the normal page and \"Play\" mode</td></tr>"
        + "<tr><td class='pLaYkey'>1</td><td>Start Jeopardy! round (or restart it)</td></tr>"
        + "<tr><td class='pLaYkey'>2</td><td>Start Double Jeopardy! round (or restart it)</td></tr>"
        + "<tr><td class='pLaYkey'>3</td><td>Start Final Jeopardy! round (or restart it)</td></tr>"
        + "<tr><td class='pLaYkey'>u</td><td>Toggle uppercase in clues on/off</td></tr>"
        + "<tr><td class='pLaYkey'>h</td><td>Show/Hide this help</td></tr>"
        + '</table>'
        + '</td></tr></table>';

    containing_el.appendChild(div_el);

    return div_el;
}

function createCluePopup()
{
    clueDiv = document.createElement('div');
    clueDiv.id = 'new_clue_review';
    clueDiv.className = 'clue pLaYpopup';
    clueDiv.onclick = function() { goForward(); return false; };
    clueDiv.style.display = 'none';
    clueDiv.needResize = 1;
    document.body.appendChild(clueDiv);
}

function delayedInit()
{
    for (let num = 1; num <= 60; num++) {
        let clue = clues[num];
        let id = clue.id;
        if (!id)
            continue;
        let new_el = document.getElementById(id + '_new');
        new_el.style.color = 'gold';
        new_el.style.textShadow = bigDropShadow;
        new_el.style.borderColor = num == 1 ? 'red' : 'black';
        new_el.num = num;
        clue.value = new_el.value;
    }

    // Some of these buttons may not exist (if the associated section isn't there yet).
    let onclicks = {
        toggle_btn: function() { startJeopardy(0); },
        J_btn: function() { startJeopardy(1); },
        DJ_btn: function() { startJeopardy(31); },
        FJ_btn: function() { startJeopardy(61); },
        upper_btn: function() { toggleUpperClues(); },
        help_btn: function() { toggleHelp(); },
        my_yes: function() { noteUserAnswer(1); },
        my_no: function() { noteUserAnswer(-1); },
        my_undo: function() { noteUserAnswer(0); },
    };

    for (let btn_id in onclicks) {
        let el = document.getElementById(btn_id);
        if (el)
            el.onclick = onclicks[btn_id];
    }
}

function toggleClue(el, num, skipClue)
{
    if (num === undefined)
        return;

    let cur = currentClueIndex; // Make a note to check if this changes.

    let clue = clues[num];
    if (!el)
        el = document.getElementById(clue.id + '_new');

    userAnswerNum = num;

    if (!clue.done) {
        if (el) {
            el.style.color = '#0000AF';
            el.style.textShadow = 'none';
            el.style.borderColor = 'black';
        }
        for (let who in contestants)
            contestants[who].adjust_el.innerHTML = '&nbsp;';
        if (skipClue) {
            finishClueParsing(clue);
            changeScores(clue, 1);
            clue.done = 2;
        } else {
            activeNum = num; // Set this global for displayClueScreen()
            clue.done = 1;

            displayClueScreen(1);
        }
        while (currentClueIndex <= 62 && clues[currentClueIndex].done)
            currentClueIndex++;
    } else { // Return a clue to the board.
        el.style.color = 'gold';
        el.style.textShadow = bigDropShadow;
        if (clue.done == 2)
            changeScores(clue, -1);
        clue.done = 0;
        for (currentClueIndex = 1; clues[currentClueIndex].done; currentClueIndex++) { }
    }

    if (currentClueIndex != cur) {
        let id = clues[currentClueIndex].id;
        if (id) {
            let next_el = document.getElementById(id + '_new');
            next_el.style.borderColor = 'red';
        }
        if (clues[cur].id) {
            let prev_el = document.getElementById(clues[cur].id + '_new');
            if (!clues[cur].done) {
                prev_el.style.color = 'gold';
                prev_el.style.textShadow = bigDropShadow;
            }
            prev_el.style.borderColor = 'black';
        }
        if (!activeNum)
            checkActiveBoard();
    }
}

function tweakClue(clue)
{
    return clue.replace(
        /^(\(<a .*?a>\.?\)|\(\S+ of the clue crew .+?\))/i,
        '<div class="pLaYcluecrew">$1</div>'
    ).replace(
        /(\d)(th|st|nd|rd|s)([.,:;!?"]*(?:\s|$))/g,
        '$1<span style="text-transform: lowercase">$2</span>$3'
    ).replace(
        /((?:^|\s)(?![AI]s\s)[A-Z.]+)(s)([.,:;!?"]*\s)/g,
        '$1<span style="text-transform: lowercase">$2</span>$3'
    );
}

function finishClueParsing(clue)
{
    if (!clue.response) {
        clue.query = tweakClue(document.getElementById(clue.id).innerHTML);

        let html = document.getElementById(clue.id + '_r').innerHTML;
        let m = html.match(/^([^<].+?)?<em class.+?>(.*?)<\/em>(.+)/);
        if (!m)
            m = [ 0, null, 'UNMATCHED', 'UNMATCHED' ];
        let response = m[1] ? m[1] : '', ans = m[2], tbl = m[3];

        let tweaks = responseTweaks['game_' + game_id + '_' + clue.id];
        if (tweaks) {
            for (let j = 0; j < tweaks.length-1; j += 2)
                response = response.replace(tweaks[j], tweaks[j+1]);
        }

        let right_re = /"right">(.+?)</g;
        let right = [ ];
        while ((m = right_re.exec(tbl)) !== null) {
            let who = m[1];
            right.push(who);
        }

        let wrong_re = /"wrong">(.+?)</g;
        let wrong = [ ];
        let triple_stumper = false;
        while ((m = wrong_re.exec(tbl)) !== null) {
            let who = m[1];
            if (who.match(/^triple /i)) {
                triple_stumper = true;
                continue;
            }
            wrong.push(who);
        }

        let abbrev_ans = ans;
        if (!triple_stumper) {
            abbrev_ans = ans.replace(/^("?(?:<i>)?)\((.+?)\)\s+/, '$1');
            if (ans != abbrev_ans)
                ans = ans.replace(/^("?(?:<i>)?)\((.+?)\)\s+/, '$1$2 ');
            else {
                abbrev_ans = ans.replace(/^(.+)\s+\((.+)\)("?(?:<\/i>)?)$/, '$1$3');
                if (ans != abbrev_ans)
                    ans = ans.replace(/^(.+)\s+\((.+)\)("?(?:<\/i>)?)$/, '$1 $2$3');
            }
        }

        let em = '<em class="correct_response">', before = '', after = '';

        let response_re = /(^|.*?>\s*)<RESPONSE>(\((?:[^<]|<(?!br))+\))\s*(<.+|$)/;
        let dotdotdot_re = /^(|.+>)(\.\.\.)(<.+)$/;
        let right_one = right.length ? right[0] : 'NOT-USED';
        right_one = '(^|.*?>\\s*)(\\(' + right_one + '[ :](?:[^<]|<(?!br))*\\[\\*\\](?:[^<]|<(?!br))*\\))\\s*';
        let right_ansref_re = right.length ? new RegExp(right_one + '(<.+|$)', '') : null;
        let right_ansref_dotdotdot_re = right.length ? new RegExp(right_one + '\s*<br>\.\.\.(<.+|$)', '') : null;
        let ansref_re = /(^|.*?>\s*)(\((?:[^<]|<(?!br))*\[\*\](?:[^<]|<(?!br))*\))\s*(<.+|$)/;
        let brs_re = /^(<br>)+|(<br>)+$/g;

        m = response_re.exec(response);
        if (!m) {
            m = right_ansref_dotdotdot_re ? right_ansref_dotdotdot_re.exec(response) : null;
            if (!m)
                m = dotdotdot_re.exec(response);
        }
        if (m) {
            before = m[1];
            response = m[2] != '...' ? m[2] : '';
            after = m[3];
            m = dotdotdot_re.exec(before);
            if (m) {
                clue.preClueBanter = m[1];
                before = m[3];
            }
            if (!response && after) {
                if (right.length) {
                    m = right_ansref_re.exec(after);
                    if (m) {
                        response = m[2];
                        after = m[3];
                        if (m[1].replace(brs_re, '') != '') {
                            if (clue.preClueBanter) {
                                // Huh?  This should never happen...
                                before += m[1];
                            } else {
                                clue.preClueBanter = before;
                                before = m[1];
                            }
                        }
                    }
                } else {
                    m = ansref_re.exec(after);
                    if (m && m[1].replace(brs_re, '') == '') {
                        response = m[2];
                        after = m[3];
                    }
                }
            }
        } else {
            m = right.length ? right_ansref_re.exec(response) : null;
            if (m) {
                before = m[1];
                response = m[2];
                after = m[3];
            } else {
                m = ansref_re.exec(response);
                if (m) {
                    before = m[1];
                    if (right.length) {
                        response = '';
                        after = m[2] + m[3];
                    } else {
                        response = m[2];
                        after = m[3];
                    }
                } else {
                    // Note that "Correct" doesn't have a space in order to match "Correctamente".
                    let resp_re = new RegExp("^\\((\\w+: \\.\\.\\.(?:[^<]|<(?!br))+[^?]\\)(<|$)|Alex: (Correct|That(?:'| i)s right|You got it|Yeah|.*could have (also added|added also)))")
                    //if (response.match(/^\((\w+: \.\.\.(?:[^<]|<(?!br))+[^?]\)(<|$)|Alex: (Correct|That(?:'| i)s right|You got it|Yeah|.*could have (also added|added also)))/))
                    if (response.match(resp_re))
                        after = response;
                    else {
                        let after_re = /(^|.*?>\s*)((?:\((?:[^<]|<(?!br))*(?:[Mm]ake a selection|ran the category|You(?: a|')re right|picked the right one|is the right question|re on a roll\.| for \$\d| minute.* left in | minute to go| [Ss]elect( again)?\.|(?:[Gg]ood|[Nn]ice) going!|<i>Jeopardy)(?:[^<]|<(?!br))*\)|\[The end.of.round signal sounds\.?\])\s*<.+|$)/;
                        m = after_re.exec(response);
                        if (m) {
                            before = m[1];
                            after = m[2];
                        } else
                            before = response;
                    }
                    response = '';
                }
            }
        }

        before = before.replace(brs_re, '');
        after = after.replace(brs_re, '');

        if (right.length) {
            if (!response)
                response = right[0] + ': ' + em + abbrev_ans + '</em>?';
        } else {
            if (!clue.dd_wager && wrong.length < 3)
                before += '<div class="pLaYbeepbeep">&lt;beep beep&gt;</div>';
            if (!response)
                response = em + ans + '</em>';
        }

        clue.response = '';
        if (before)
            clue.response += '<div>' + before.replace(/\[\*\]/g, em + abbrev_ans + '</em>').replace(/\[\*\*\]/g, em + abbrev_ans + '</em>') + '</div>';
        clue.response += '<div>' + response.replace(/^\(|\)$/g, '').replace(/\[\*\]/g, em + abbrev_ans + '</em>').replace(/\[\*\*\]/g, em + abbrev_ans + '</em>').replace(/(<br>|<p>)+$/, '') + '</div>';

        if (abbrev_ans != ans && !after.match(/\[\*/))
            clue.response += '<div>(Confirmed: ' + em + ans + '</em>.)</div>';
        if (after)
            clue.response += '<div>' + after.replace(/\[\*\]/g, em + ans + '</em>').replace(/\[\*\*\]/g, em + abbrev_ans + '</em>') + '</div>';

        if (clue.dd_wager)
            clue.dd_who = right.length ? right[0] : wrong[0];

        let incr = clue.dd_wager ? clue.dd_wager : clue.value;
        clue.scores = { Combo_Coryat: 0 };

        for (let j in right) {
            let who = right[j];
            clue.scores[who] = incr;
            clue.scores['Combo_Coryat'] += clue.value;
        }

        for (let j in wrong) {
            let who = wrong[j];
            clue.scores[who] = -incr;
            if (!clue.dd_wager)
                clue.scores['Combo_Coryat'] -= clue.value;
        }
    }
}

function checkClueResize()
{
    if (clueDiv.needResize) {
        let tbl_id = currentClueIndex <= 30 ? 'jeopardy_round_new'
                   : currentClueIndex <= 60 ? 'double_jeopardy_round_new'
                   : 'final_jeopardy_round_new';
        let tbl_el = document.getElementById(tbl_id);
        if (tbl_el) {
            let _x = 0;
            let _y = 0;
            for (el = tbl_el; el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop); el = el.offsetParent) {
                _x += el.offsetLeft - el.scrollLeft;
                _y += el.offsetTop - el.scrollTop;
            }
            clueDiv.style.top = _y + 'px';
            clueDiv.style.left = _x + 'px';
            clueDiv.style.width = (tbl_el.offsetWidth + 4) + 'px';
            clueDiv.style.height = (tbl_el.offsetHeight + 4) + 'px';
            clueDiv.needResize = 0;
        }
    }
}

function displayClueScreen(incr)
{
    let clue = clues[activeNum];
    finishClueParsing(clue);

    checkClueResize();

    if (!clueDiv.showing) {
        clueDiv.showing = 0;
        clueDiv.cluePages = [ null ];

        if (clue.dd_wager) {
            let h = '<div style="color: gold; font-size: 3em; text-shadow: ' + bigDropShadow + ';"><big>DAILY</big><br>'
                  + 'DOUBLE</div><br>'
                  + clue.dd_who + "'s wager: " + prettyDollars(clue.dd_wager, '$');
            clueDiv.cluePages.push(h);
        }

        if (clue.preClueBanter)
            clueDiv.cluePages.push(clue.preClueBanter);

        clueDiv.queryPos = clueDiv.cluePages.length;
        pushTextAndMediaPages(clue.query);
        clueDiv.responses_start_at = clueDiv.cluePages.length;

        if (clue.fj_order) {
            let someone_was_right;
            for (let j in clue.fj_order) {
                let who = clue.fj_order[j].who;
                clueDiv.cluePages.push(clue.response[who]);
                if (clue.fj_order[j].right)
                    someone_was_right = 1;
            }
            if (!someone_was_right)
                clueDiv.cluePages.push('We were looking for <em class="correct_response">' + clue.correct_response + '</em>');
            if (clue.banter)
                pushTextAndMediaPages(clue.banter);
        } else
            clueDiv.cluePages.push(clue.response);
    }

    let html = clueDiv.cluePages[clueDiv.showing += incr];
    if (!html) {
        hideClue();
        return;
    }

    let upper_style = wantUpperClues ? 'text-transform: uppercase;' : '';
    let font_style = clueDiv.showing == clueDiv.queryPos ? ' style="font-size: 133%; text-shadow: ' + bigDropShadow + ';' + upper_style + '"' : '';
    if (clueDiv.showing >= clueDiv.responses_start_at) {
        if (!clue.fj_order) {
            if (clue.done != 2) {
                changeScores(clue, 1);
                clue.done = 2;
            }
        } else {
            for (j = 0; j < clue.fj_order.length; j++) {
                let who = clue.fj_order[j].who;
                if (clue.done == 2) {
                    // If done == 2, then all the values are already updated,
                    // even if we didn't reveal the new value to the user yet.
                    contestants[who].score_el.value -= clue.scores[who];
                }
                if (clueDiv.showing >= clueDiv.responses_start_at + j)
                    adjustOneScore(who, clue.scores[who], 1);
                else {
                    adjustOneScore(who, 0, 1);
                    contestants[who].score_el.value += clue.scores[who];
                }
            }
            clue.done = 2;
        }
    } else if (clue.done == 2) {
        changeScores(clue, -1);
        clue.done = 1;
    }

    let nodeString = '<table class="pLaYclueTbl"' + font_style + '>'
                      + '<tr align="center"><td valign="middle">' + html + '</td></tr></table>';
    let tableElement = new DOMParser().parseFromString(nodeString, "text/html").body.firstElementChild;
    clueDiv.innerHTML = "";
    clueDiv.appendChild(tableElement);
    //clueDiv.innerHTML = '<table class="pLaYclueTbl"' + font_style + '>'
    //                  + '<tr align="center"><td valign="middle">' + html + '</td></tr></table>';
    clueDiv.style.display = 'block';
}

function pushTextAndMediaPages(txt)
{
    let m, media_re = /<a href="([^"]+?)"/g;

    clueDiv.cluePages.push(txt);

    while ((m = media_re.exec(txt)) !== null) {
        let got = m[1];
        let h = got.match(/\.(?:jpg|png|gif)$/)
              ? '<img src="' + got + '">'
              : '<iframe src="' + got + '" height="99%" width="80%"></iframe>';
        clueDiv.cluePages.push(h);
    }
}
// edit end

function hideClue()
{
    clueDiv.style.display = 'none';
    clueDiv.innerHTML = '&nbsp;'; // Make sure any audio/video stops.
    clueDiv.showing = null;
    activeNum = 0;
    checkActiveBoard();
}

function changeScores(clue, mult)
{
    for (let who in contestants) {
        if (clue.scores[who])
            adjustOneScore(who, clue.scores[who], mult);
        else
            adjustOneScore(who, 0, 0);
    }
}

// Called with mult == 0 to just update adjust_el.
function adjustOneScore(who, incr, mult, fudge_total=false)
{
    if (mult)
        incr *= mult;

    if (mult) { // We must do this even if incr is 0 for when the value updates apart from innerHTML.
        let score_el = contestants[who].score_el;
        score_el.value += incr;
        score_el.className = score_el.value >= 0 ? 'score_positive' : 'score_negative';
	// edit start
        score_el.innerText = prettyDollars(score_el.value, '$');
        // score_el.innerHTML = prettyDollars(score_el.value, '$');
	// edit end
        if (fudge_total)
            score_el.value -= incr;
    }

    let adjust_el = contestants[who].adjust_el;
    if (incr && mult >= 0) {
        let color = incr >= 0 ? 'green' : 'red';
	// edit start
        adjust_el.innerHTML = '&nbsp;';
	let s = document.createElement('span');
	s.setAttribute("style", "background-color: " + color);
	s.innerText = prettyDollars(incr, '+');
	adjust_el.appendChild(s);
    } else
        adjust_el.innerHTML = '&nbsp;';
}

function prettyDollars(num, prefix)
{
    if (prefix == '+' && num < 0)
        prefix = '';
    let str = prefix + num;
    while (1) {
        let new_str = str.replace(/(\d)(\d\d\d)(,|$)/, "$1,$2$3");
        if (new_str == str)
            break;
        str = new_str;
    }
    return str;
}

function checkActiveBoard()
{
    if (currentClueIndex <= 30) {
        if (jDiv.style.display == 'none') {
            djDiv.style.display = 'none';
            if (fjDiv)
                fjDiv.style.display = 'none';
            jDiv.style.display = 'block';
            clueDiv.needResize = 1;
        }
    } else if (currentClueIndex <= 60) {
        if (djDiv && djDiv.style.display == 'none') {
            jDiv.style.display = 'none';
            fjDiv.style.display = 'none';
            djDiv.style.display = 'block';
            clueDiv.needResize = 1;
        }
    } else {
        if (fjDiv && fjDiv.style.display == 'none') {
            jDiv.style.display = 'none';
            djDiv.style.display = 'none';
            fjDiv.style.display = 'block';
            clueDiv.needResize = 1;
        }
    }
}

function goForward(skipClue)
{
    if (activeNum == 0) {
        if (currentClueIndex <= 62)
            toggleClue(null, currentClueIndex, skipClue);
    } else if (skipClue) {
        let clue = clues[activeNum];
        if (clue.fj_order && clue.done == 2) {
            // We may not have output all the new scores yet, so let's backup and do this again.
            for (let j in clue.fj_order) {
                let who = clue.fj_order[j].who;
                contestants[who].score_el.value -= clue.scores[who];
            }
            clue.done = 1;
        }
        if (clue.done != 2) {
            changeScores(clue, 1);
            clue.done = 2;
        }
        hideClue();
    } else
        displayClueScreen(1);
}

function goBackward(skipClue)
{
    let was_at;
    if (activeNum != 0) {
        was_at = activeNum;
        if (skipClue)
            hideClue();
        else {
            displayClueScreen(-1);
            if (activeNum != 0)
                return;
        }
    } else if (currentClueIndex > 1) {
        for (was_at = currentClueIndex - 1; clues[was_at].done < 0; was_at--)
            continue;
    } else
        return;
    if (was_at >= 1)
        toggleClue(null, was_at, skipClue);
    if (activeNum == 0)
        userAnswerNum = 0;
}

function noteUserAnswer(mult)
{
    if (userAnswerNum > 0 && userAnswerNum < 61) {
        let clue = clues[userAnswerNum];
        let who = 'Your_Coryat';
        let fudging = userAnswerNum == activeNum && clueDiv.showing < clueDiv.responses_start_at;
        if (!fudging && clue.scores[who]) // Undo prior adjust (done separately for proper diff value).
            adjustOneScore(who, clue.scores[who], -1);
        if (clue.dd_wager && mult < 0)
            mult = 0;
        let diff = clue.value * mult;
        if (diff)
            adjustOneScore(who, diff, 1, fudging);
        else if (fudging)
            adjustOneScore(who, 0, 1);
        clue.scores[who] = diff;
    }
}

initialize();

// vim: et sw=4
