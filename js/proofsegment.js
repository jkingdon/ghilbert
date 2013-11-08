// When proofs are displayed they are organized hierarchically into proof segments.
// by Paul Merrell, 2013

GH.ProofSegment = function(state, type, step, hasPrevious, cursorPosition) {	
	this.parent = null;
	this.children = [];
	this.siblingIndex = -1;
	this.step = step;
	this.state = state;
	this.type = type;
	this.isOpen = false;
	this.hasPrevious = hasPrevious;
	this.attachChildrenData = null;  // Saved data to attach children when needed.

	this.smallElement = null;
	this.largeElement = this.createLargeElement();
};

GH.ProofSegment.State = {
	SMALL: 0,
	LARGE: 1
};

// Most of the type enum never gets used, but this explains what all the types mean.
GH.ProofSegment.Type = {
	WHITE_OUTER: 0,  // A white-colored outer block.
	WHITE_INNER: 1,  // A block inside a white block. It is white when open, gray when closed.
	 GRAY_OUTER: 2,  // A gray-colored outer block.
	 GRAY_INNER: 3,  // A block inside a gray block. It is gray when open, white when closed.
};

GH.ProofSegment.createSegments = function(conclusion, stack, segmentCount, cursorPosition) {
	var rootSegment = new GH.ProofSegment(GH.ProofSegment.State.LARGE, GH.ProofSegment.Type.WHITE_OUTER, conclusion, false, cursorPosition);
	rootSegment.siblingIndex = segmentCount;
	stack.appendChild(rootSegment.largeElement);

	var stepsData = GH.ProofSegment.findImportantSteps(conclusion, null);
	rootSegment.attachChildren(stepsData, true, cursorPosition);
	rootSegment.addNames();
	rootSegment.resize();
	return rootSegment;
};

GH.ProofSegment.prototype.addHandlers = function() {
	var position = '[' + this.getPosition().toString() + ']';
	this.smallElement.setAttribute('onmouseover', 'GH.ProofSegment.handleMouseOver(' + position + ')');
	this.smallElement.setAttribute('onmouseout', 'GH.ProofSegment.handleMouseOut('  + position + ')');
	this.smallElement.setAttribute('onclick', 'GH.ProofSegment.handleClick('  + position + ')');
	if (this.type % 2) {
		GH.ProofStep.addClass_(this.largeElement, 'inner-block');
	}
};

GH.ProofSegment.prototype.addNames = function() {
	for (var i = 0; i < this.children.length; i++) {
		var prevStep = (i == 0) ? null : this.children[i - 1].step;
		var step = this.children[i].step;
		var nextStep = (i == this.children.length - 1) ? null : this.children[i + 1].step;

		var singleStep = false;
		if (i == this.children.length - 1) {
			var steps = [];
			for (var j = 0; j < this.children.length; j++) {
				steps.push(this.children[j].step);
			}
			singleStep = (GH.ProofSegment.isSingleStep(this.step, steps));
		}
		var name;
		if (this.hasPrevious && (i == 0)) {
			name = '';
		} else if (singleStep) {
			name = step.title || step.name_.toString();
		} else {
			name = GH.ProofSegment.getName(prevStep, step, nextStep);
		}
		var smallElement = this.children[i].smallElement;
		smallElement.children[smallElement.children.length - 1].children[0].innerHTML = name;
		this.children[i].addNames();
	}
};

GH.ProofSegment.getName = function(prevStep, step, nextStep) {
	var name = step.title || step.name_.toString();
	var hierarchy = step.hierarchy;
	while (hierarchy && (!prevStep || prevStep.end <= hierarchy.begin) && (!nextStep || nextStep.begin >= hierarchy.end)) {
		if (hierarchy.name) {
			name = hierarchy.name;
		}
		hierarchy = hierarchy.parent;
	}
	return name;
};

// Returns true, if the steps are equal to the hypotheses and conclusion of a single step.
GH.ProofSegment.isSingleStep = function(step, steps) {
	var hyps = steps.slice(0)
	hyps.pop();
	if (!(GH.ProofSegment.isSubset(step.hypotheses, hyps) &&
 	      GH.ProofSegment.isSubset(hyps, step.hypotheses))) {
		return false;
	}
	// This test probably isn't necessary, but why not.
	if (step.conclusion != steps[steps.length - 1].conclusion) {
		return false;
	}
	return true;
};

GH.ProofSegment.prototype.attachChildren = function(stepsData, recursion, cursorPosition) {
	var steps = stepsData.steps;
	var tableElement = GH.ProofSegment.addTable(this.largeElement);
	
	for (var i = 0; i < steps.length; i++) {
		var endStep = (i > 0) ? steps[i - 1] : null;
		var newStepsData = GH.ProofSegment.findImportantSteps(steps[i], endStep);
		// If this is a single step or in other words it corresponds directly to a particular theorem, use 
		// the styling of that theorem to display the steps in a table with similar terms arranged in columns.
		var isSingleStep = GH.ProofSegment.isSingleStep(this.step, steps);
		var stylized = this.step.styling && isSingleStep;

		// If this is stylized in a table, we unfortunately cannot display the child of this step as an inner block.
		// The problem is that there is no way to replace one row of the table with the inner block. 
		var type = this.type + 1;
		var skipType = stylized && (type % 2 == 1);
		type += skipType ? 1 : 0;
		type = type % 4;
		var child = new GH.ProofSegment(GH.ProofSegment.State.SMALL, type, steps[i], newStepsData.hasEnd, cursorPosition);
		child.parent = this;
		this.children.push(child);
		child.siblingIndex = i;

		var isConclusion = (i == steps.length - 1);
		if (stylized) {
			var styleIndex = isConclusion ? i : this.step.hypotheses.indexOf(steps[i]);
			var stylizedExpression = GH.RenderableProofStep.styleExpression(this.step.styling[styleIndex], steps[i].conclusion);
			var partialHtml = GH.sexptohtmlHighlighted(stylizedExpression, cursorPosition);
			var nameHtml = GH.ProofStep.nameToHtml(steps[i].name_, steps[i].title, isConclusion, steps[i].link, isConclusion);
			var fullHtml = GH.ProofStep.stepToHtml(partialHtml, '', nameHtml);
			child.smallElement = fullHtml;
			tableElement.appendChild(child.smallElement);
		} else {
			tableElement = GH.ProofSegment.addTable(this.largeElement);
			var text = GH.sexptohtmlHighlighted(steps[i].conclusion, cursorPosition);
			var link = isSingleStep ? steps[i].link : '';
			var nameHtml = GH.ProofStep.nameToHtml(steps[i].name_, steps[i].title, isSingleStep && isConclusion, link, isSingleStep && isConclusion);
			child.smallElement = GH.ProofStep.stepToHtml(text, '', nameHtml);
			tableElement.appendChild(child.smallElement);
		}

		if (type % 2 == 0) {
			var referenceElement = skipType ? this.largeElement : this.parent.largeElement;
			stack.insertBefore(child.largeElement, referenceElement);
		} else {
			this.largeElement.appendChild(child.largeElement);
		}
		child.addHandlers();
		child.updateVisibility();

		if (recursion) {
			var newIsSubset = (GH.ProofSegment.isSubset(newStepsData.steps, stepsData.steps));
			var oldIsSubset = (GH.ProofSegment.isSubset(stepsData.steps, newStepsData.steps));
			if (!oldIsSubset || !newIsSubset) {
				// Calling child.attachChildren(newStepsData, !newIsSubset, cursorPosition) here is slow if
				// we're not displaying any of the children. We save all the information so that we can display
				// the children when they are needed.
				child.attachChildrenData = {stepsData: newStepsData, recursion: !newIsSubset, cursorPosition: cursorPosition};
			}
		}
	}
};


GH.ProofSegment.prototype.delayedAttachChildren = function() {
	var data = this.attachChildrenData;
	if (data) {
		this.attachChildren(data.stepsData, data.recursion, data.cursorPosition);
		this.addNames();
	}
	this.attachChildrenData = null;
};

// Returns true if the steps in A are a subset of the steps in B.
GH.ProofSegment.isSubset = function(A, B) {
	for (var i = 0; i < A.length; i++) {
		var match = false;
		for (var j = 0; j < B.length; j++) {
			if (A[i] == B[j]) {
				match = true;
			}
		}
		if (!match) {
			return false;
		}
	}
	return true;
};

GH.ProofSegment.addTable = function(parent) {
	var tableElement = document.createElement("table");
	tableElement.setAttribute('cellspacing', 0);
	tableElement.setAttribute('class', 'table-no-border');
	parent.appendChild(tableElement);
	return tableElement;
};

GH.ProofSegment.prototype.createStepElement = function(cursorPosition) {
};

GH.ProofSegment.prototype.createLargeElement = function() {
	var largeElement = document.createElement("div");
	largeElement.setAttribute('class', 'proof-block');
	return largeElement;
};

GH.ProofSegment.prototype.getPrevElement = function() {
	return this.parent && this.parent.children[this.siblingIndex - 1].smallElement;
};

GH.ProofSegment.prototype.updateVisibility = function() {
	if (this.state == GH.ProofSegment.State.SMALL) {
		this.smallElement.setAttribute('style', '');
		GH.ProofStep.removeClass_(this.smallElement, 'highlighted-step');
		GH.ProofStep.removeClass_(this.smallElement, 'highlighted-bottom');
		GH.ProofStep.removeClass_(this.smallElement, 'open-top');
		GH.ProofStep.removeClass_(this.smallElement, 'open-bottom');
		GH.ProofStep.removeClass_(this.smallElement, 'highlighted-open-top');
		GH.ProofStep.removeClass_(this.smallElement, 'highlighted-open-bottom');
		this.largeElement.setAttribute('style', 'display: none');
	} else if (this.state == GH.ProofSegment.State.LARGE) {
		if (this.type % 2) {
			this.smallElement.setAttribute('style', 'display: none');
			if (this.hasPrevious) {
				this.parent.children[this.siblingIndex - 1].smallElement.setAttribute('style', 'display: none');
			}
		} else {
			GH.ProofStep.addClass_(this.smallElement, 'highlighted-step');
			if (this.hasPrevious) {
				GH.ProofStep.addClass_(this.smallElement, 'highlighted-open-top');
				GH.ProofStep.addClass_(this.getPrevElement(), 'highlighted-bottom');
			}
		}
		this.largeElement.setAttribute('style', '');
	}
	if (((this.type + !this.isOpen) % 4) >= 2) {
		GH.ProofStep.addClass_(this.largeElement, 'gray-block');
	} else {
		GH.ProofStep.removeClass_(this.largeElement, 'gray-block');
	}
};

GH.ProofSegment.prototype.resize = function() {
	for (var i = 0; i < this.children.length; i++) {
		this.children[i].resize();
	}
	if (this.state == GH.ProofSegment.State.LARGE) {
		this.resizeTables();
	}
};

// Enlarge the last column of each table so that each row spans the width of the block.
GH.ProofSegment.prototype.resizeTables = function(){
	for (var i = 0; i < this.children.length; i++) {
		var row = this.children[i].smallElement;
		var lastCell = row.lastChild;
		lastCell.setAttribute('style', 'width: auto');
	}
	for (var i = 0; i < this.children.length; i++) {
		var row = this.children[i].smallElement;
		var lastCell = row.lastChild;
		// The width is equal to the current width plus the difference between the block and the table width.
		var newWidth = this.largeElement.offsetWidth - row.offsetWidth + parseInt(window.getComputedStyle(lastCell).width) - 20;
		lastCell.setAttribute('style', 'width: ' + newWidth);
	}
};

GH.ProofSegment.prototype.getActiveElement = function () {
	if (this.state == GH.ProofSegment.State.SMALL) {
		return this.smallElement;
	}
	if (this.state == GH.ProofSegment.State.LARGE) {
		return this.largeElement;
	}
};

GH.ProofSegment.prototype.close = function() {
	this.isOpen = false;
	for (var i = 0; i < this.children.length; i++) {
		var child = this.children[i];
		child.close();
		child.state = GH.ProofSegment.State.SMALL;
		child.updateVisibility();
	}
	this.updateVisibility();
	this.resize();	
};

GH.ProofSegment.prototype.expand = function() {
	if (this.parent) {
		this.parent.isOpen = true;
	}
	this.close();
	this.updateVisibility();
	if (this.parent) {
		this.parent.updateVisibility();
	}
	this.resizeTables();	
};

GH.ProofSegment.prototype.highlight = function() {
	GH.ProofStep.addClass_(this.smallElement, GH.ProofStep.ORANGE_STEP_);
	GH.ProofStep.addClass_(this.largeElement, GH.ProofStep.ORANGE_BLOCK_);
	if (this.hasPrevious) {
		GH.ProofStep.addClass_(this.getPrevElement(), GH.ProofStep.ORANGE_STEP_);
		GH.ProofStep.addClass_(this.getPrevElement(), 'open-bottom');
		GH.ProofStep.addClass_(this.smallElement, 'open-top');
	}
};

GH.ProofSegment.prototype.lowlight = function() {
	GH.ProofStep.removeClass_(this.smallElement, GH.ProofStep.ORANGE_STEP_);
	GH.ProofStep.removeClass_(this.largeElement, GH.ProofStep.ORANGE_BLOCK_);
	if (this.hasPrevious) {
		GH.ProofStep.removeClass_(this.getPrevElement(), GH.ProofStep.ORANGE_STEP_);
		GH.ProofStep.removeClass_(this.getPrevElement(), 'open-bottom');
		GH.ProofStep.removeClass_(this.smallElement, 'open-top');
	}
};

GH.ProofSegment.prototype.handleClick = function() {
	this.delayedAttachChildren();
	if (this.largeElement.children.length > 0) {
		this.state = GH.ProofSegment.State.LARGE;
		this.lowlight();
		this.expand();
		this.close();
	}
};

GH.ProofSegment.expand = function (step) {
	if (step.hypotheses.length == 0) {
		return new GH.StepSegment(step);
	}
	var childSegments = [];
	for (var i = 0; i < step.hypotheses.length; i++) {
		childSegments.push(new GH.StepSegment(step.hypotheses[i]));
	}
	childSegments.push(new GH.StepSegment(step));
	return new GH.BlockSegment(childSegments);
};

GH.ProofSegment.prototype.getPosition = function() {
	var position = [];
	var segment = this;
	while (segment.parent) {
		position.push(segment.siblingIndex);
		segment = segment.parent;
	}
	position.push(segment.siblingIndex);
	return position;
};

GH.ProofSegment.findSegments = function(position) {
	var segment = window.direct.rootSegments[position.pop()];
	while (position.length > 0) {
		segment = segment.children[position.pop()];
	}

	var parentOpen = (segment.parent && segment.parent.isOpen);
	var hasChildren = (segment.largeElement.children.length > 0) || segment.attachChildrenData;
    var lastSibling = segment.parent && (segment.siblingIndex == segment.parent.children.length - 1);
	var isPrevious = segment.parent && segment.parent.hasPrevious && (segment.siblingIndex == 0);
	var isHighlighted = GH.ProofStep.hasClass_(segment.smallElement, 'highlighted-step');
	if (GH.ProofStep.hasClass_(segment.smallElement, 'highlighted-bottom') && segment.parent) {
		return [segment.parent.children[segment.siblingIndex + 1]];
	}
	if ((!parentOpen && (!lastSibling || hasChildren) && !isPrevious) || isHighlighted) {
		return [segment];
	} else {
		if (!isPrevious || parentOpen) {
			return [segment.parent];
		} else {
			return [segment.parent.parent, segment.parent];
		}
	}
};

GH.ProofSegment.handleMouseOver = function(position) {
	var segments = GH.ProofSegment.findSegments(position);
	for (var i = 0; i < segments.length; i++) {
		segments[i].highlight();
	}
};

GH.ProofSegment.handleMouseOut = function(position) {
	var segments = GH.ProofSegment.findSegments(position);
	for (var i = 0; i < segments.length; i++) {
		segments[i].lowlight();
	}
};

GH.ProofSegment.handleClick = function(position) {
	var segments = GH.ProofSegment.findSegments(position);
	segments[0].handleClick();
};

GH.ProofSegment.findImportantSteps = function(startStep, endStep) {
	var importantSteps = GH.ProofSegment.findImportantStepsEnd(startStep, endStep);
	var originalHasEnd = importantSteps.hasEnd;
	if (importantSteps.steps.length == 2) {
		endStep = importantSteps.steps[0];
		importantSteps = GH.ProofSegment.findImportantStepsEnd(startStep, endStep);
		importantSteps.hasEnd = originalHasEnd;
	}
	return importantSteps;
};

// Same as findImportantStepsRecursive, but includes the start and end steps if either is missing.
GH.ProofSegment.findImportantStepsEnd = function(startStep, endStep) {
	var importantSteps = GH.ProofSegment.findImportantStepsRecursive(startStep, startStep, endStep);
	// Include the start step, if it is missing.
	if (importantSteps.steps[importantSteps.steps.length - 1] != startStep) {
		importantSteps.steps.push(startStep);
	}
	// Include the end step if it is missing.
	if (endStep && importantSteps.hasEnd && importantSteps.steps[0] != endStep) {
		importantSteps.steps.splice(0, 0, endStep);
	}
	return importantSteps;
};

GH.ProofSegment.findImportantStepsRecursive = function(step, startStep, endStep) {
	if (step == endStep) {
		return {depth: 1e10, steps: [], hasEnd: true};
	}

	var results = [];
	var conclusionDepth = step.hierarchy.getDepth();
	var minDepth = 1e10;
	var minIndices = [];
	var endIndex = -1;
	for (var i = 0; i < step.hypotheses.length; i++) {
		var branchResult = GH.ProofSegment.findImportantStepsRecursive(step.hypotheses[i], startStep, endStep);
		results.push(branchResult);
		if (branchResult.depth < minDepth) {
			minDepth = branchResult.depth;
			minIndices = [i];
		} else if (branchResult.depth == minDepth) {
			minIndices.push(i);
		}
		if (branchResult.hasEnd) {
			endIndex = i;
		}
	}

	if (endIndex == -1) {
		if ((conclusionDepth < minDepth) && ((step != startStep) || (results.length == 0))) {
			return {depth: conclusionDepth, steps: [step], hasEnd: false};
		}
		// If there are two branches with the lowest depth, we are doing a branch which includes everything
		// even high depth hypotheses.
		if (minIndices.length > 1) {
			var steps = [];
			for (var i = 0; i < step.hypotheses.length; i++) {
				steps.push(step.hypotheses[i]);
			}
			steps.push(step);
			return {depth: minDepth, steps: steps, hasEnd: false};
		}
		var result = results[minIndices[0]];
		if (conclusionDepth <= minDepth) {
			result.steps.push(step);
		}
		return {depth: minDepth, steps: result.steps, hasEnd: false};
	} else {
		var endStep = step.hypotheses[endIndex];
		var endDepth = endStep.hierarchy.getDepth();
		var endSteps = results[endIndex].steps;
		
		if ((step == startStep) && (endSteps.length == 0)) {
			var steps = [endStep];
			for (var i = 0; i < step.hypotheses.length; i++) {
				if (i != endIndex) {
					steps.push(step.hypotheses[i]);
				}
			}
			steps.push(step);
			return {depth: 1e10, steps: steps, hasEnd: true};
		}
		
		var addConclusion = false;
		if ((conclusionDepth < minDepth) && (step != startStep)) {
			return {depth: conclusionDepth, steps: [step], hasEnd: true};
		}
		if (minDepth >= endDepth) {
			// Add hypothesis if not already included.
			if (endSteps[endSteps.length - 1] != endStep) {
				endSteps.push(endStep);
				addConclusion = true;
			}
		}
		if (conclusionDepth <= endDepth) {
			addConclusion = true;
		}
		if (addConclusion) {
			endSteps.push(step);
		}
		return {depth: minDepth, steps: endSteps, hasEnd: true};
	}
};