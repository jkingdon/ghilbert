// Javascript for generating Ghilbert proof steps automatically.
// by Paul Merrell, 2013

GH.Prover = function(suggestArea, direct) {
	this.depth = 1;
	this.direct = direct;
	this.conclusions = [];
	this.activeExp = null;
	this.stack = [];
	this.openExps = [];

	this.primaryArea = document.createElement('div');
	this.secondaryArea = document.createElement('div');
	this.primaryButtons = document.createElement('span');
	this.secondaryButtons = document.createElement('span');
	this.activeExpDisplay = document.createElement('span');
	this.secondaryExpDisplay = document.createElement('span');
	this.primaryButtons.setAttribute('class', 'suggest-button');
	this.secondaryButtons.setAttribute('class', 'suggest-button');
	this.primaryArea.setAttribute('class', 'suggest-area');
	this.secondaryArea.setAttribute('class', 'suggest-area secondary');
	this.activeExpDisplay.setAttribute('class', 'suggest-exp');
	this.secondaryExpDisplay.setAttribute('class', 'suggest-exp');
	
	suggestArea.appendChild(this.secondaryArea);
	suggestArea.appendChild(this.primaryArea);
	this.primaryArea.appendChild(this.activeExpDisplay);
	this.primaryArea.appendChild(this.primaryButtons);
	this.secondaryArea.appendChild(this.secondaryExpDisplay);
	this.secondaryArea.appendChild(this.secondaryButtons);

	this.remover = new GH.remover(this);
	this.replacer = new GH.ProofGenerator.replacer(this);
	this.repositioner = new GH.repositioner(this);

	this.commuter = new GH.ProofGenerator.commuter(this);
	this.evaluator = new GH.ProofGenerator.evaluator(this);
	this.distributorLeft  = new GH.ProofGenerator.distributorLeft(this);
	this.distributorRight = new GH.ProofGenerator.distributorRight(this);
	this.undistributorLeft  = new GH.ProofGenerator.undistributorLeft(this);
	this.undistributorRight = new GH.ProofGenerator.undistributorRight(this);
	this.associatorLeft  = new GH.ProofGenerator.associatorLeft(this);
	this.associatorRight = new GH.ProofGenerator.associatorRight(this);

	this.generators = [
		{name: 'Commute',    gen: this.commuter},
		{name: 'Dist. L',    gen: this.distributorLeft},
		{name: 'Dist. R',    gen: this.distributorRight},
		{name: 'Undist. L',  gen: this.undistributorLeft},
		{name: 'Undist. R',  gen: this.undistributorRight},
		{name: 'Ass. L',     gen: this.associatorLeft},
		{name: 'Ass. R',     gen: this.associatorRight},
	];
};

GH.Prover.prototype.openExp = function(sexp, name) {
	var thmCount = this.direct.getTheorems().length;
	this.openExps.push({sexp: sexp, thmCount: thmCount, modified: false, name: name, styling: []});
	this.incrementDepth(name);
	return sexp.copy();
};

GH.Prover.prototype.closeExp = function(sexp) {
	var closedExp = this.openExps.pop();
	var result;
	var thmCount = this.direct.getTheorems().length;
	if (thmCount > closedExp.thmCount) {
		result = this.replace(closedExp.sexp);
	} else {
		if (closedExp.modified) {
			result = sexp;
		} else {
			result = closedExp.sexp;
		}
	}
	
	if (closedExp.modified == true) {
		this.decrementDepth(closedExp.name);
	} else {
		this.depth--;
	}
	
	return result;
};

GH.Prover.prototype.updateActiveExp = function(theorems, stack) {
	this.activeExp = null;
	if (stack.length == 1) {
		this.activeExp = GH.sExpression.fromRaw(stack[0][1]);
	} else if (stack.length == 0) {
		if (this.conclusions.length >= 1) {
			this.activeExp = this.conclusions[this.conclusions.length - 1];
		}
	}
	this.displayActiveExp();
};

// Handle selecting a child of the select expression.
GH.Prover.prototype.onChildClick = function(operandNum) {
	this.activeExp = this.activeExp.operands[operandNum];
	this.displayActiveExp();
};

// Get the index into whichever child is selected.
GH.Prover.getSelectedIndex = function(elem) {
	for (var i = 0; i < elem.childElementCount; i++) {
		var child = elem.children[i];
		if (GH.ProofStep.hasClass_(child, 'selected-ancestor') ||
		    GH.ProofStep.hasClass_(child, 'selectable-ancestor') ||
		    GH.ProofStep.hasClass_(child, 'selected-exp')) {
			return i;
		}
	}
	alert('No selected element found.');
};

/**
 * Move the activeExp back to one of its ancestors.
 * This is currently disabled directly, but used indirectly for uncles. 
 * It should be used directly for something like  (prime 1 + 1), but it breaks the child clicking.
 */
GH.Prover.prototype.onAncestorClick = function(clickedAncestor) {
	var currentElement = clickedAncestor;
	while (!GH.ProofStep.hasClass_(currentElement, 'selected-exp')) {
		selectedIndex = GH.Prover.getSelectedIndex(currentElement);
		currentElement = currentElement.children[selectedIndex];
		this.activeExp = this.activeExp.parent;
	}	
	this.displayActiveExp();
};

// Move the activeExp back to the parent of the uncle and the currect activeExp.
GH.Prover.prototype.onUncleClick = function(clickedUncle) {
	this.onUncleMouseOut(clickedUncle);
	this.onAncestorClick(clickedUncle.parentElement);
};

// Apply CSS styling when hovering over an uncle.
GH.Prover.prototype.onUncleMouseOver = function(uncle) {
	uncle.parentElement.className += ' hovered-ancestor';
};

// Remove CSS styling when hovering over an uncle.
GH.Prover.prototype.onUncleMouseOut = function(uncle) {
	GH.ProofStep.removeClass_(uncle.parentElement, 'hovered-ancestor');
};

// Add click handles to the children and uncles of the activeExp.
GH.Prover.addClickHandlers = function(displayedExp, counter) {
	if (displayedExp.className == 'selectable-child') {
		displayedExp.setAttribute('onclick', 'window.direct.prover.onChildClick(' + counter.operand + ')');
		counter.operand++;
	}
	for (var i = 0; i < displayedExp.childElementCount; i++) {
		var child = displayedExp.children[i];
		GH.Prover.addClickHandlers(child, counter);
	}
	if (displayedExp.className == 'selected-uncle') {
		displayedExp.setAttribute('onclick', 'window.direct.prover.onUncleClick(this)');
		displayedExp.setAttribute('onmouseover', 'window.direct.prover.onUncleMouseOver(this)');
		displayedExp.setAttribute('onmouseout', 'window.direct.prover.onUncleMouseOut(this)');
		counter.parent++;
	}
	/*
	if (displayedExp.className == 'selectable-ancestor') {
		displayedExp.setAttribute('onclick', 'window.direct.prover.onAncestorClick(this)');
		counter.parent++;
	}*/
};

// Find the selected state of the current expression.
GH.Prover.getSelectionState = function(expression, index, selectedIndex, isAncestor) {
	var selectionState;
	if (index == selectedIndex) {
		if (isAncestor) {
			selectionState = 'selected-ancestor';
		} else {
			selectionState = 'selected-exp';
		}
		var exp = (index >= 0) ? expression[index] : expression;
		if (exp.length == 1) {
			selectionState += ' no-child';
		}
	} else {
		selectionState = 'selected-uncle';
	}
	return selectionState;
};

// Traverses the expression tree up to the where the current selection. Set classes and click handlers.
GH.Prover.prototype.displayActiveExp = function() {
	if (!this.activeExp) {
		this.updateSuggestButtons();
		return;
	}	

	var root = this.activeExp.getRoot();
	var rootExpressionToShow = root.getExpression();
	var position = GH.Prover.findPosition(this.activeExp);

	if (!root.isProven) {
		this.activeExpDisplay.innerHTML = GH.sexptohtmlHighlighted(rootExpressionToShow, -1);
		this.updateSuggestButtons();
		return;
	}

	// if (position.length != 0) && (rootExpressionToShow.length == 2) { selectionState = 'selectable-ancestor';}  // Currently disabled.
	var selectionState = GH.Prover.getSelectionState(rootExpressionToShow, -1, -1, position.length > 0);
	rootExpressionToShow = ['htmlSpan', selectionState, rootExpressionToShow];
	expressionToShow = rootExpressionToShow[2];
	for (var i = 0; i < position.length; i++) {
		var pos = position[i] + 1;
		for (var j = 1; j < expressionToShow.length; j++) {
			selectionState = GH.Prover.getSelectionState(expressionToShow, j, pos, (i != position.length - 1));
			expressionToShow[j] = ['htmlSpan', selectionState, expressionToShow[j]];
		}
		expressionToShow = expressionToShow[pos];
		expressionToShow = expressionToShow[2];
	}
	for (var i = 1; i < expressionToShow.length; i++) {
		expressionToShow[i] = ['htmlSpan', 'selectable-child', expressionToShow[i]];
	}
	this.activeExpDisplay.innerHTML = GH.sexptohtmlHighlighted(rootExpressionToShow, -1);
	GH.Prover.addClickHandlers(this.activeExpDisplay, {operand: 0, parent: 0});
	this.updateSuggestButtons();
};

GH.Prover.highlightMatch = function(expression, match) {
	var position = GH.Prover.findPosition(match);
	if (position.length > 0) {
		var expressionRoot = expression;
		for (var i = 0; i < position.length; i++) {
			var pos = position[i] + 1;
			if (i < position.length - 1) {
				expression = expression[pos];
			} else {
				expression[pos] = ['htmlSpan', 'matching-exp', expression[pos]];
			}
		}
		return expressionRoot;
	} else {
		return ['htmlSpan', 'matching-exp', expression];
	}
};

GH.Prover.prototype.update = function(theorems, stack) {
	this.stack = stack;	
	this.conclusions = GH.Prover.getConclusions(theorems);
	this.updateActiveExp(theorems, stack);
};

GH.Prover.prototype.updateSuggestButtons = function() {
	// Remove the existing buttons.
	while(this.primaryButtons.firstChild){
    	this.primaryButtons.removeChild(this.primaryButtons.firstChild);
	}
	while(this.secondaryButtons.firstChild){
    	this.secondaryButtons.removeChild(this.secondaryButtons.firstChild);
	}

	GH.ProofStep.removeClass_(this.secondaryArea, 'active');
	if (this.activeExp) {
		GH.ProofStep.addClass_(this.primaryArea, 'active');
		if (this.activeExp.getRoot().isProven) {
			this.addSuggestion('Copy', 'window.direct.prover.handleCopy()', true);
		}
	} else {
		GH.ProofStep.removeClass_(this.primaryArea, 'active');
		return;
	}

	for (var i = 0; i < this.generators.length; i++) {
		var generator = this.generators[i];
		if (generator.gen.isApplicable(this.activeExp)) {
			this.addSuggestion(generator.name, 'window.direct.prover.handleClick(\'' + generator.name + '\')', true);
		}
	}
	if (this.evaluator.isApplicable(this.activeExp)) {
		this.addSuggestion('Evaluate', 'window.direct.prover.handleEvaluate()', true);
	}

	this.secondaryExpDisplay.innerHTML = '';
	if ((this.stack.length == 0) && (this.activeExp.parent == null)) {	
		if (this.conclusions.length >= 2) {
			var prevConclusion = this.conclusions[this.conclusions.length - 2];
			var lastConclusion = this.activeExp;
			if (prevConclusion) {
				var match = null;
				if (this.replacer.isApplicable(prevConclusion, lastConclusion)) {
					this.addSuggestion('Substitute', 'window.direct.prover.handleSubstitute()', false);
					match = GH.Prover.findMatch(prevConclusion, lastConclusion.left())
				}
				if (this.remover.isApplicable(prevConclusion, lastConclusion)) {
					this.addSuggestion('Remove', 'window.direct.prover.remove()', false);
					match = GH.Prover.findMatch(prevConclusion, lastConclusion)				
					if ((!match) && (lastConclusion.operator == '-.')) {
						isNegated = true;
						match = GH.Prover.findMatch(prevConclusion, lastConclusion.child());
					}
				}
				if (match) {
					var expression = prevConclusion.getExpression();
					GH.Prover.highlightMatch(expression, match);
					this.secondaryExpDisplay.innerHTML = GH.sexptohtmlHighlighted(expression, -1);
					GH.ProofStep.addClass_(this.secondaryArea, 'active');
				}
			}
		}
	}
};

GH.Prover.prototype.addSuggestion = function(name, clickHandler, isPrimary) {
	var suggestion = document.createElement('input');
	suggestion.setAttribute('type', 'button');
	suggestion.setAttribute('value', name);
	suggestion.setAttribute('onclick', clickHandler);
	if (isPrimary) {
		this.primaryButtons.appendChild(suggestion);
	} else {
		this.secondaryButtons.appendChild(suggestion);
	}
};

GH.Prover.prototype.indent = function() {
	var text = this.indentText();
	this.direct.insertText(text);
};

GH.Prover.prototype.indentText = function() {
	var text = '';
	for (var i = 0; i < this.depth; i++) {
		text += '  ';
	}
	return text;
};

// Print text into the proof.
GH.Prover.prototype.insertText = function(text) {
	this.direct.insertText(text);
};

GH.Prover.prototype.onModify = function() {
	for (var i = 0; i < this.openExps.length; i++) {
		var openExp = this.openExps[i];
		if (!openExp.modified) {
			openExp.modified = true;
			for (var j = 0; j < openExp.styling.length; j++) {
				this.insertText(openExp.styling[j]);
			}
		}
	}
};

// Print text into the proof and add a new line.
GH.Prover.prototype.println = function(text) {
	this.onModify();
	this.indent();
	this.insertText(text + '\n');
};

// Insert a known theorem into the proof with all it's mandatory hypotheses.
GH.Prover.prototype.print = function(mandHyps, step) {
	this.onModify();
	this.indent();
	for (var i = 0; i < mandHyps.length; i++) {
		this.insertText(mandHyps[i].toString() + ' ');
	}
	this.insertText(step + '\n');
};

GH.Prover.prototype.makeString = function(mandHyps, step, output) {
	var result = '';
/*	for (var i = 0; i < this.depth; i++) {
		result += '  ';
	}*/
	for (var i = 0; i < mandHyps.length; i++) {
		result += mandHyps[i].toString() + ' ';
	}
	result += step;
	output.push(result);
};

// Returns a list of the theorems from the stack. The list contains
// all the conclusions of theorems converted into s-expressions.
GH.Prover.prototype.getTheorems = function() {
	// The update is commented out because it's unnecessary and slow, but I'm leaving it
	// here because it is really useful for debugging. Just uncomment it and you can see
	// the proofs changing while you're debugging.
	
	// TODO: Fix problems with 3 + 3 and 3 | 7. Theorems get repeated. Then comment this out again.	
	this.direct.update(true);
	var theorems = this.direct.getTheorems();
	return GH.Prover.getConclusions(theorems);
};

GH.Prover.getConclusions = function(theorems) {
	if (!theorems) {
		return [];
	}
	
	var result = [];
	for (var i = 0; i < theorems.length; i++) {
		// TODO: Rename public variables and make conclusion an s-expression.
		var conclusion = GH.sExpression.fromRaw(theorems[i].conclusion);
		conclusion.isProven = true;
		result.push(conclusion);
	}
	return result;
};
	
// Return the last theorem on the proof stack.
GH.Prover.prototype.getLast = function() {
	var theorems = this.getTheorems();
	return theorems[theorems.length -  1];
};
	
// Return the last expression on the proof stack.
GH.Prover.prototype.getActiveExp = function() {
	return this.activeExp;
};
	
// Convert a number to an s-expression and insert it into the stack.
GH.Prover.prototype.printNum = function(num) {
	this.println(GH.numUtil.numToSexpString(num));
};

GH.Prover.prototype.openNumberAdder = function() {
	var num = window.prompt('Enter a number:', '');
	num = parseInt(num);
	if ((!isNaN(num)) && (num >= 0)) {
		this.printNum(num);
		this.direct.update(true);
	}
}

// TODO: Rename and describe function.
GH.Prover.findPosition = function(sexp) {
	var indices = [];
	// Traverse up the tree from matcher up to the root and record which sibling
	// of the tree we traverse at each step.
	while (sexp.parent != null) {
		indices.push(sexp.siblingIndex);
		sexp = sexp.parent;
	}
	
	// Return the indices in reverse to tell how to descend through the tree.
	return indices.reverse();
};
	
/**
 * FindMatchingPosition takes two s-expressions. An s-expression is represented
 * as a position within a tree. sexp and matcher have a very close tree structure,
 * but sexp is at the root of the tree and matcher is somewhere within the tree.
 * In this function, sexp moves into the position where matcher is.
 */
GH.Prover.findMatchingPosition = function(sexp, matcher) {
	var indices = GH.Prover.findPosition(matcher);
	if (GH.operatorUtil.getRootType(matcher) != 'wff') {
		// If the original expression is not a wff, the result is an equilance statement. Take the right part.	
		sexp = sexp.right();
	}

	// Traverse down the sexp tree. This is just the reverse of the ascent up.
	for (var i = 0; i < indices.length; i++) {
		sexp = sexp.operands[indices[i]];
	}
	return sexp;
};

/**
 * Apply a proof generator. The proof generator can automatically
 * generate theorems. Those theorems may or may not be in the repository. This function
 * is designed to work in either case. If the theorem is in the repository this function
 * will look it up and use it. If it is not in the repository, this function will
 * generate all the necessary steps to apply the generator.
 */
GH.Prover.prototype.apply = function(generator, sexp) {
	var action = generator.action(sexp);
	if (this.symbolDefined(action.name)) {
		// Uses the proof if it already exists in the repository.
		this.print(action.hyps, action.name);
	} else {
		// If not already defined, generate the proof either as a new theorem or inline.
		if (generator.canAddTheorem(sexp)) {
			var result = this.getLast();
			var savedThm = this.direct.removeCurrentTheorem();
			var savedDepth = this.depth;
			var savedOpenExps = this.openExps;
			this.depth = 0;
			this.openExps = [];
			this.println('');
			this.println('');
			generator.addTheorem(sexp, result);
			this.direct.insertText(savedThm.join(''));
			this.depth = savedDepth;
			this.openExps = savedOpenExps;
			this.depth++;
			this.println(action.name);
			this.depth--;
			this.direct.update(false);
		} else {
			var added = generator.inline(sexp);
			if (!added) {
				alert(action.name + ' is not in the repository and cannot be generated.');
			}
		}
	}
};

GH.Prover.prototype.incrementDepth = function(name) {
	if (name) {
		name = ' \'' + name + '\'';
	} else {
		name = '';
	}
	var text = this.indentText() + '## <d' + name + '>\n';
	var lastUnmodified = null;
	if (this.openExps.length > 0) {
		var lastOpen = this.openExps[this.openExps.length - 1];
		if (!lastOpen.modified) {
			lastUnmodified = lastOpen;
		}
	}
	if (lastUnmodified) {
		lastUnmodified.styling.push(text);
	} else {
		this.insertText(text);
	}
	this.depth++;
};

GH.Prover.prototype.decrementDepth = function(name) {
	this.depth--;
	if (name) {
		name = ' \'' + name + '\'';
	} else {
		name = '';
	}
	this.indent();
	this.insertText('## </d' + name + '>\n');
};

/**
 * Replace an s-expression using a proof generator. The proof generator can automatically
 * generate theorems. Those theorems may or may not be in the repository. This function
 * is designed to work in either case. If the theorem is in the repository this function
 * will look it up and use it. If it is not in the repository, this function will
 * generate all the necessary steps to replace the s-expression.
 */
GH.Prover.prototype.replaceWith = function(generator, sexp) {
	if (!generator.isApplicable(sexp)) {
		return sexp;
	}
	this.incrementDepth();
	this.apply(generator, sexp);
	this.decrementDepth();
	return this.replace(sexp);
};

GH.Prover.prototype.applyWith = function(generator, sexp) {
	if (!generator.isApplicable(sexp)) {
		return sexp;
	}
	this.apply(generator, sexp);
	return this.getLast();
};


GH.Prover.prototype.openWith = function(generator, sexp, name) {
	sexp = this.openExp(sexp, 'Distributive Property');
	sexp = this.applyWith(generator, sexp);
	return this.closeExp(sexp);
};

// Like replaceWith, but when you have an ordinary function not a generator.
// Ideally functions would be converted into generators so that the generated
// theorems can be saved and reused.
GH.Prover.prototype.replaceFunc = function(func, sexp, caller) {
	this.incrementDepth();
	func.call(caller, sexp);
	this.decrementDepth();
	return this.replace(sexp);
};

/**
 * Replace an s-expression using a proof generator. The proof generator can automatically
 * generate theorems. Those theorems may or may not be in the repository. This function
 * is designed to work in either case. If the theorem is in the repository this function
 * will look it up and use it. If it is not in the repository, this function will
 * generate all the necessary steps to replace the s-expression.
 */
GH.Prover.prototype.replace = function(sexp) {
	var replacement = this.getLast();
	// When evaluating a wff, the replacement doesn't apply.
	this.apply(this.replacer, sexp);
	
	var replaced = this.getLast();
	if (sexp.parent) {
		return GH.Prover.findMatchingPosition(replaced, sexp);
	} else {
		if (GH.operatorUtil.getType(sexp) == 'wff') {
			return replaced;
		} else {
			return replaced.right();
		}
	}
};

GH.Prover.prototype.remove = function() {
	this.println('');
	this.conclusions = this.getTheorems();
	var removee = this.conclusions[this.conclusions.length - 2];
	var remover = this.conclusions[this.conclusions.length - 1];
	var output = this.remover.maybeRemove(removee, remover);
	for (var i = 0; i < output.length; i++) {
		this.println(output[i]);
	}
	this.direct.update(false);
	
	output = [];
	removee = this.conclusions[this.conclusions.length - 1];
	this.remover.removeBoolean(removee, output);
	for (var i = 0; i < output.length; i++) {
		this.println(output[i]);
	}
	// TODO: Check if this is hurting efficiency.
	this.direct.update(true);
	// TODO: Replace a wff multiple times if it appears multiple times.
	return this.getLast();
};

GH.Prover.prototype.symbolDefined = function(name) {
	if (name == null) {
		return false;
	}
	if (this.direct.vg.syms.hasOwnProperty(name)) {
		return true;
	}
	var newSyms = this.direct.thmctx.newSyms;
	for (var i = 0; i < newSyms.length; i++) {
		if (newSyms[i] == name) {
			return true;
		}
	}
	return false;
};

/**
 * From an s-expression and an expected form extracts all the hypotheses out of
 * the sexp. For example, if sexp = 2 * (3 + 4) and expectedForm = A * B, it will
 * extract two hypotheses A: 2 and B: 3 + 4. The hypotheses may be returned in the
 * wrong order.
 */
GH.Prover.prototype.getUnorderedHyps = function(sexp, expectedForm, hyps) {
	var operandsExpected = expectedForm.operands.length;
	var operandsActual   =         sexp.operands.length;
	// Every variable in the expected form may represent a large expression that has many operands, so it is
	// not a problem if there are operands when we expect none.
	if ((operandsExpected != operandsActual) && (operandsExpected != 0)) {
		return null;
	} else if (operandsExpected > 0) {
		var operatorExpected = expectedForm.operator.toString();
		var operatorActual   =         sexp.operator.toString();
		if ((operatorExpected != operatorActual) && (operatorExpected != 'operator')) {
			return null;
		} else {
			for (var i = 0; i < operandsExpected; i++) {
				hyps = this.getUnorderedHyps(sexp.operands[i], expectedForm.operands[i], hyps);
				if (hyps == null) {
					return null;
				}
			}
			return hyps;
		}
	} else {
		var expression = expectedForm.getExpression();
		if ((expression in hyps) && (!hyps[expression].equals(sexp))) {
			return null;
		} else {
			hyps[expression] = sexp;
			return hyps;
		}
	}
};

GH.Prover.defaultOrder = ['A', 'B', 'C', 'D', 'E', 'F'];

// From an s-expression and an expected form extracts all the hypotheses out of
// the sexp. For example, if sexp = 2 * (3 + 4) and expectedForm = A * B, it will
// extract two hypotheses A: 2 and B: 3 + 4. The hypotheses are returned in the
// default order.
GH.Prover.prototype.getHyps = function(sexp, expectedForm) {
	var hyps = this.getUnorderedHyps(sexp, expectedForm, {});
	if (hyps == null) {
		return null;
	}

	var hypsInOrder = [];
	for (var i = 0; i < GH.Prover.defaultOrder.length; i++) {
		var key = GH.Prover.defaultOrder[i];
		if (key in hyps) {
			hypsInOrder.push(hyps[key]);
		}
	}
	return hypsInOrder;
};

// From a set hypotheses and an expected form generates a s-expression. This
// performs the reverse operation of getHyps. If the expectedForm is A * B
// and the newHyps are A: 2 and B: 3 + 4, then it returns 2 * (3 + 4).
GH.Prover.prototype.setHyps = function(expectedForm, newHyps) {
	var sexp = expectedForm.copy(null);
	var hyps = this.getUnorderedHyps(sexp, expectedForm, {});
	var keys = [];
	for (var i = 0; i < GH.Prover.defaultOrder.length; i++) {
		var key = GH.Prover.defaultOrder[i];
		if (key in hyps) {
			keys.push(key);
		}
	}
	return this.setHypsWithKeys(sexp, keys, newHyps);
};

// Fill in an s-expresson from with a set of key and hyps.
// For example, if sexp = A * B, and keys = [A, B] and hyps = [2, 3 + 4],
// then this function returns the expression 2 * (3 + 4).
GH.Prover.prototype.setHypsWithKeys = function(sexp, keys, hyps) {
	var operandsNum = sexp.operands.length;
	if (operandsNum > 0) {
		for (var i = 0; i < operandsNum; i++) {
			sexp = this.setHypsWithKeys(sexp.operands[i], keys, hyps).parent;
		}
		return sexp;
	} else {
		var expression = sexp.getExpression();
		for (var i = 0; i < keys.length; i++) {
			if (keys[i] == expression) {
				var newSexp = hyps[i].copy();
				sexp.parent.operands[sexp.siblingIndex] = newSexp;
				newSexp.parent = sexp.parent;
				return newSexp;
			}
		}
		alert('Key never found.');
		return null;
	}	
};

GH.ProofGenerator = {};

GH.action = function(name, hyps) {
	this.name = name;
	this.hyps = hyps;
};

GH.Prover.prototype.reposition = function(sexp, oldPosition, newPosition) {
	return this.repositioner.reposition(sexp, oldPosition, newPosition);
};

GH.Prover.prototype.clearStack = function() {
	if (this.stack.length == 1) {
		this.direct.removeExpression(this.activeExp);
	}
};

GH.Prover.prototype.associateLeft = function(sexp) {
	sexp = this.openExp(sexp, 'Associative Property');
	sexp = this.applyWith(this.associatorLeft, sexp);
	return this.closeExp(sexp);
	return result;
};

GH.Prover.prototype.associateRight = function(sexp) {
	sexp = this.openExp(sexp, 'Associative Property');
	sexp = this.applyWith(this.associatorRight, sexp);
	return this.closeExp(sexp);
	return result;
};

GH.Prover.prototype.distributeLeft = function(sexp) {
	sexp = this.openExp(sexp, 'Distributive Property');
	sexp = this.applyWith(this.distributorLeft, sexp);
	return this.closeExp(sexp);
};

GH.Prover.prototype.distributeRight = function(sexp) {
	sexp = this.openExp(sexp, 'Distributive Property');
	sexp = this.applyWith(this.distributorRight, sexp);
	return this.closeExp(sexp);
};

GH.Prover.prototype.undistributeLeft = function(sexp) {
	sexp = this.openExp(sexp, 'Distributive Property');
	sexp = this.applyWith(this.undistributorLeft, sexp);
	return this.closeExp(sexp);
};

GH.Prover.prototype.undistributeRight = function(sexp) {
	sexp = this.openExp(sexp, 'Distributive Property');
	sexp = this.applyWith(this.undistributorRight, sexp);
	return this.closeExp(sexp);
};

GH.Prover.prototype.evaluate = function(sexp, name) {
	if (GH.operatorUtil.getType(sexp) == 'wff') {
		// TODO: Check that this case is actually different.
		return this.applyWith(this.evaluator, sexp);
	} else {
		name = name ? name : 'Evaluate';
		sexp = this.openExp(sexp, name);
		sexp = this.applyWith(this.evaluator, sexp);
		return this.closeExp(sexp);
		
	}
};

// Reverse the process of the normal evaluation. Evaluation compresses expressions.
// This is a way of expanding them.
GH.Prover.prototype.unevaluate = function(sexp, replacee) {
	var result = this.evaluate(sexp);
	result = this.commute(result.parent);
	if (GH.operatorUtil.getType(sexp) == 'wff') {
		return this.remove();
	} else {
		return this.replace(replacee);
	}
};

GH.Prover.prototype.calculate = function(sexp) {
	return this.evaluator.calculate(sexp);
};

GH.Prover.prototype.commute = function(sexp) {
	if (sexp.left().equals(sexp.right())) {  // No need to commute when both sides are the same.
		return sexp;
	} else {
		sexp = this.openExp(sexp, 'Commutative Property');
		sexp = this.applyWith(this.commuter, sexp);
		return this.closeExp(sexp);
	}
};

GH.Prover.prototype.handleCopy = function() {
	this.print([this.activeExp], '');
	this.direct.update(true);
};

GH.Prover.prototype.handleClick = function(name) {
	this.clearStack();
	this.println('');
	var result;
	for (var i = 0; i < this.generators.length; i++) {
		if (this.generators[i].name == name) {
			result = this.replaceWith(this.generators[i].gen, this.activeExp);
		}
	}
	this.direct.update(true);

	// The result gets overwritten by the update.
	this.activeExp = result;
	this.displayActiveExp();
};

GH.Prover.prototype.handleEvaluate = function() {
	this.clearStack();
	this.println('');
	var result = this.evaluate(this.activeExp);
	this.direct.update(true);

	// The result gets overwritten by the update.
	this.activeExp = result;
	this.displayActiveExp();
};

GH.Prover.findMatch = function(sexp, matchee) {
	if (sexp.equals(matchee)) {
		return sexp;
	} else {
		for (var i = 0; i < sexp.operands.length; i++) {
			var foundMatch = GH.Prover.findMatch(sexp.operands[i], matchee);
			if (foundMatch) {
				return foundMatch;
			}
		}
		return null;
	}
};

GH.Prover.prototype.handleSubstitute = function() {
	this.println('');
	var replacee = this.conclusions[this.conclusions.length - 2];
	var replacement = this.conclusions[this.conclusions.length - 1];
	var myMatch = GH.Prover.findMatch(replacee, replacement.left());
	var result = this.replace(myMatch);

	this.direct.update(true);
	this.activeExp = result;
	this.activeExp.getRoot().isProven = true;
	this.displayActiveExp();

	// TODO: Replace a value multiple times if it appears multiple times.
	/*while (myMatch) {
		replacee = this.replacer.addReplaceThm(myMatch);
		myMatch = GH.Prover.findMatch(replacee, replacement.left());
	}*/
};

// Call a function, but increase the depth so it is hidden by default.
GH.Prover.prototype.applyHidden = function(applyFunc, sexp, caller) {
	this.incrementDepth();
	var result = applyFunc.call(caller, sexp);
	this.decrementDepth();
	return result;
};

// Apply a function to the right side of an s-expression. This does not change
// the position of the s-expression.
GH.Prover.applyRight = function(applyFunc, sexp, caller) {
	return applyFunc.call(caller, sexp.right()).parent;
};

// Apply a function to the right side of an s-expression. This does not change
// the position of the s-expression.
GH.Prover.applyLeft = function(applyFunc, sexp, caller) {
	return applyFunc.call(caller, sexp.left()).parent;
};

// Apply a function to the right side of an s-expression. This does not change
// the position of the s-expression.
GH.Prover.prototype.applyRight = function(applyFunc, sexp) {
	return applyFunc.call(this, sexp.right()).parent;
};

// Apply a function to the left side of an s-expression. This does not change
// the position of the s-expression.
GH.Prover.prototype.applyLeft = function(applyFunc, sexp) {
	return applyFunc.call(this, sexp.left()).parent;
};

// Replace the left side of an s-expression. This does not change the position
// of the s-expression.
GH.Prover.prototype.replaceLeft = function(generator, sexp) {
	return this.replaceWith(generator, sexp.left()).parent;
};

// Replace the right side of an s-expression. This does not change the position
// of the s-expression.
GH.Prover.prototype.replaceRight = function(generator, sexp) {
	return this.replaceWith(generator, sexp.right()).parent;
};