/*
---
provides: Slick
description: The new, superfast css selector engine.
requires: SlickParser

license: MIT-style

authors:
- Thomas Aylott
- Valerio Proietti
- Fabio M Costa
...
*/
(function(){
	
	var local = {};
	
	var window = this, document = this.document, root = document.documentElement;

	local.document = document;
	
	// Slick
	
	var Slick = local.Slick = function(context, expression, append){
		
		// setup
		
		var parsed, found = append || [];
		local.positions = {};
		
		// handle input / context:
		
		if (expression == null){
			return found;

		} else if (typeof expression == 'string'){
			parsed = Slick.parse(expression);
			if (!parsed.length) return found;

		} else if (expression.Slick){
			parsed = expression;

		} else if (local.contains(context, expression)){
			found.push(expression);
			return found;

		} else {
			return found;
		}

		var document = (context.ownerDocument || context);
		if (document != local.document) Slick.setDocument(document);
		local.document = document;

		if (parsed.length === 1 && parsed.expressions[0].length === 1) local.push = local.pushArray;
		else local.push = local.pushUID;
		
		// custom engines
		
		customEngine: {
			var customEngineName = 'customEngine:' + (local.isXMLDocument ? 'XML:' : '') + parsed.type.join(':');
			if (typeof local[customEngineName] != 'function') break customEngine;
			if (typeof local[customEngineName+' check'] == 'function' && !local[customEngineName+' check'](context, parsed)) break customEngine;
			
			local.found = found;
			local[customEngineName](context, parsed);
			return found;
		}
		
		// querySelectorAll
		
		QSA: if (context.querySelectorAll && !(!parsed.simple || local.isXMLDocument || local.brokenMixedCaseQSA || Slick.disableQSA)){
			if (context.nodeType !== 9) break QSA; // FIXME: Make querySelectorAll work with a context that isn't a document
			
			var nodes;
			try { nodes = context.querySelectorAll(expression); }
			catch(error){ if (Slick.debug) Slick.debug('QSA Fail ' + expression, error); };
			
			if (!nodes) break QSA;
			nodes = local.collectionToArray(nodes);
			if (!append) return nodes;
			
			if (local.starSelectsClosedQSA) local.push.apply(local, nodes, '*');
			else found.push.apply(found, nodes);
			return found;
			
		}
		
		// default engine
		
		var currentExpression, currentBit;
		var i, j, m, n;
		var combinator, tag, id, parts, classes, attributes, pseudos;
		var current, items;
		var tempUniques = {};
		var expressions = parsed.expressions;
		
		for (i = 0; (currentExpression = expressions[i]); i++) for (j = 0; (currentBit = currentExpression[j]); j++){
			
			combinator = 'combinator:' + currentBit.combinator;
			tag        = local.isXMLDocument ? currentBit.tag : currentBit.tag.toUpperCase();
			id         = currentBit.id;
			parts      = currentBit.parts;
			classes    = currentBit.classes;
			attributes = currentBit.attributes;
			pseudos    = currentBit.pseudos;
			
			local.localUniques = {};
			
			if (j === (currentExpression.length - 1)){
				local.uniques = tempUniques;
				local.found = found;
			} else {
				local.uniques = {};
				local.found = [];
			}
	
			if (j == 0){
				local[combinator](context, tag, id, parts, classes, attributes, pseudos);
			} else {
				items = current;
				if (local[combinator])
					for (m = 0, n = items.length; m < n; m++) local[combinator](items[m], tag, id, parts, classes, attributes, pseudos);
				else
					if (Slick.debug) Slick.debug("Tried calling non-existant combinator: '" + currentBit.combinator + "'", currentExpression);
			}
			
			current = local.found;
		}
		
		return found;
	};
	
	// Feature / Bug detection
	
	Slick.setBrowser = function(document){
		var testNode = document.createElement('div');
		root.appendChild(testNode);
		
		// Safari 3.2 QSA doesnt work with mixedcase on quirksmode
		try{ testNode.innerHTML = '<a class="MiXedCaSe"></a>'; local.brokenMixedCaseQSA = !testNode.querySelectorAll('.MiXedCaSe').length; }catch(e){};
		
		try{
			testNode.innerHTML = '<a class="f"></a><a class="b"></a>';
			testNode.getElementsByClassName('b').length;
			testNode.firstChild.className = 'b';
			local.cachedGetElementsByClassName = (testNode.getElementsByClassName('b').length != 2);
		}catch(e){};
		
		root.removeChild(testNode);
		testNode = null;
	};
	
	Slick.setDocument = function(document){
		if (!(local.isXMLDocument = local.isXML(document))){
			var testNode = document.createElement('div');
			root.appendChild(testNode);
			
			// IE returns comment nodes for getElementsByTagName('*')
			testNode.appendChild(document.createComment(''));
			local.starSelectsComments = (testNode.getElementsByTagName('*').length > 0);
			
			// IE returns closed nodes (EG:"</foo>") for getElementsByTagName('*')
			try{ testNode.innerHTML = 'foo</foo>'; local.starSelectsClosed = (testNode.getElementsByTagName('*')[0].nodeName.charAt(0) == '/'); }catch(e){};
			try{ testNode.innerHTML = 'foo</foo>'; local.starSelectsClosedQSA = (testNode.querySelectorAll('*')[0].nodeName.charAt(0) == '/'); }catch(e){};
			
			// getElementById selects name attribute?
			try{
				testNode.innerHTML = '<a name=idgetsname>';
				local.idGetsName = !!(testNode.ownerDocument.getElementById && testNode.ownerDocument.getElementById('idgetsname'));
			}catch(e){}
			
			root.removeChild(testNode);
			testNode = null;
		}
	};
	
	// Utils
	
	local.uidx = 1;
	
	local.uidOf = (window.ActiveXObject) ? function(node){
		return (node._slickUID || (node._slickUID = [this.uidx++]))[0];
	} : function(node){
		return node._slickUID || (node._slickUID = this.uidx++);
	};
	
	// FIXME: Add specs: local.contains should be different for xml and html documents?
	local.contains = (root.contains) ? function(context, node){
		return (context !== node && context.contains(node));
	} : (root.compareDocumentPosition) ? function(context, node){
		return !!(context.compareDocumentPosition(node) & 16);
	} : function(context, node){
		if (node) while ((node = node.parentNode)){
			if (node === context) return true;
		}
		return false;
	};
	
	local.collectionToArray = function(node){
	   return Array.prototype.slice.call(node);
	};
	try{
	    local.collectionToArray(root.childNodes);
	}
	catch(e){
		local.collectionToArray = function(node){
			if (node instanceof Array) return node;
			var i = node.length, array = new Array(i);
			while (i--) array[i] = node[i];
			return array;
		};
	}
	
	local.cacheNTH = {};
	
	local.matchNTH = /^([+-]?\d*)?([a-z]+)?([+-]?\d*)?$/;
	
	local.parseNTHArgument = function(argument){
		var parsed = argument.match(this.matchNTH);
		if (!parsed) return false;
		var inta = parseInt(parsed[1], 10);
		var a = (inta || inta === 0) ? inta : 1;
		var special = parsed[2] || false;
		var b = parseInt(parsed[3], 10) || 0;
		if (a != 0){
			b--;
			while (b < 1) b += a;
			while (b >= a) b -= a;
		} else {
			a = b;
			special = 'index';
		}
		switch (special){
			case 'n':    parsed = {a: a, b: b, special: 'n'}; break;
			case 'odd':  parsed = {a: 2, b: 0, special: 'n'}; break;
			case 'even': parsed = {a: 2, b: 1, special: 'n'}; break;
			default:     parsed = {a: (a - 1), special: 'index'};
		}
		
		return (this.cacheNTH[argument] = parsed);
	};
	
	local.pushArray = function(node, tag, id, selector, classes, attributes, pseudos){
		if (this['match:selector'](node, tag, id, selector, classes, attributes, pseudos)) this.found.push(node);
	};
	
	local.pushUID = function(node, tag, id, selector, classes, attributes, pseudos){
		var uid = this.uidOf(node);
		if (!this.uniques[uid] && this['match:selector'](node, tag, id, selector, classes, attributes, pseudos)){
			this.uniques[uid] = true;
			this.found.push(node);
		}
	};
	
	local.isXML = function(element){
		var ownerDocument = element.ownerDocument || element;
		return (!!ownerDocument.xmlVersion)
			|| (!!ownerDocument.xml)
			|| (Object.prototype.toString.call(ownerDocument) == '[object XMLDocument]')
			|| (ownerDocument.nodeType == 9 && ownerDocument.documentElement.nodeName != 'HTML');
	};
	
	var matchers = {
		
		node: function(node, selector){
			var parsed = this.Slick.parse(selector).expressions[0][0];
			if (!parsed) return true;
			return this['match:selector'](node, parsed.tag.toUpperCase(), parsed.id, parsed.parts);
		},

		pseudo: function(node, name, argument){
			var pseudoName = 'pseudo:' + name;
			if (this[pseudoName]) return this[pseudoName](node, argument);
			var attribute = this.getAttribute(node, name);
			return (argument) ? argument == attribute : !!attribute;
		},

		selector: function(node, tag, id, parts, classes, attributes, pseudos){
			if (tag && tag ==='*' && (node.nodeType != 1 || node.nodeName.charAt(0) == '/')) return false; // Fix for comment nodes and closed nodes
			if (tag && tag != '*' && (!node.nodeName || node.nodeName != tag)) return false;
			if (id && node.getAttribute('id') != id) return false;
			for (var i = 0, l = parts.length; i < l; i++){
				var part = parts[i];
				switch (part.type){
					case 'class':
						if (classes !== false){
							var cls = local.getAttribute(node, 'class');
							if (!cls || !part.regexp.test(cls)) return false;
						}
					break;
					case 'pseudo': if (pseudos !== false && (!this['match:pseudo'](node, part.key, part.value))) return false; break;
					case 'attribute': if (attributes !== false && (!part.test(this.getAttribute(node, part.key)))) return false; break;
				}
			}
			return true;
		}

	};
	for (var m in matchers) local['match:' + m] = matchers[m];
	
	var combinators = {

		' ': function(node, tag, id, parts, classes, attributes, pseudos){ // all child nodes, any level
			var i, l, item, children;

			if (!this.isXMLDocument){
				getById: if (id){
					// if node == document then we don't need to use contains
					if (!node.getElementById) break getById;
					item = node.getElementById(id);
					if (!item || item.id != id) break getById;
					this.push(item, tag, null, parts);
					return;
				}
				getById: if (id){
					if (!this.document.getElementById) break getById;
					item = this.document.getElementById(id);
					if (!item || item.id != id) break getById;
					if (!this.contains(node.documentElement||node, item)) break getById;
					this.push(item, tag, null, parts);
					return;
				}
				getByClass: if (node.getElementsByClassName && classes && !this.cachedGetElementsByClassName){
					children = node.getElementsByClassName(classes.join(' '));
					if (!(children && children.length)) break getByClass;
					for (i = 0, l = children.length; i < l; i++) this.push(children[i], tag, id, parts, false);
					return;
				}
			}
			getByTag: {
				children = node.getElementsByTagName(tag);
				if (!(children && children.length)) break getByTag;
				for (i = 0, l = children.length; i < l; i++) this.push(children[i], null, id, parts);
			}
		},
		
		'!': function(node, tag, id, parts){  // all parent nodes up to document
			while ((node = node.parentNode)){
				if (node !== document) this.push(node, tag, id, parts);
			}
		},

		'>': function(node, tag, id, parts){ // direct children
			if ((node = node.firstChild)) do {
				if (node.nodeType == 1) this.push(node, tag, id, parts);
			} while ((node = node.nextSibling));
		},
		
		'!>': function(node, tag, id, parts){ // direct parent (one level)
			node = node.parentNode;
			if (node !== document) this.push(node, tag, id, parts);
		},

		'+': function(node, tag, id, parts){ // next sibling
			while ((node = node.nextSibling)){
				if (node.nodeType == 1){
					this.push(node, tag, id, parts);
					break;
				}
			}
		},

		'!+': function(node, tag, id, parts){ // previous sibling
			while ((node = node.previousSibling)){
				if (node.nodeType == 1){
					this.push(node, tag, id, parts);
					break;
				}
			}
		},

		'^': function(node, tag, id, parts){ // first child
			node = node.firstChild;
			if (node){
				if (node.nodeType == 1) this.push(node, tag, id, parts);
				else this['combinator:+>'](node, tag, id, parts);
			}
		},

		'!^': function(node, tag, id, parts){ // last child
			node = node.lastChild;
			if (node){
				if (node.nodeType == 1) this.push(node, tag, id, parts);
				else this['combinator:<+'](node, tag, id, parts);
			}
		},

		'~': function(node, tag, id, parts){ // next siblings
			while ((node = node.nextSibling)){
				if (node.nodeType != 1) continue;
				var uid = this.uidOf(node);
				if (this.localUniques[uid]) break;
				this.localUniques[uid] = true;
				this.push(node, tag, id, parts);
			}
		},

		'!~': function(node, tag, id, parts){ // previous siblings
			while ((node = node.previousSibling)){
				if (node.nodeType != 1) continue;
				var uid = this.uidOf(node);
				if (this.localUniques[uid]) break;
				this.localUniques[uid] = true;
				this.push(node, tag, id, parts);
			}
		},
		
		'++': function(node, tag, id, parts){ // next sibling and previous sibling
			this['combinator:+'](node, tag, id, parts);
			this['combinator:!+'](node, tag, id, parts);
		},

		'~~': function(node, tag, id, parts){ // next siblings and previous siblings
			this['combinator:~'](node, tag, id, parts);
			this['combinator:!~'](node, tag, id, parts);
		}

	};
	for (var c in combinators) local['combinator:' + c] = combinators[c];
	
	var pseudos = {

		'empty': function(node){
			return !(node.innerText || node.textContent || '').length;
		},

		'not': function(node, expression){
			return !this['match:node'](node, expression);
		},

		'contains': function(node, text){
			var inner = node.innerText || node.textContent || '';
			return (inner) ? inner.indexOf(text) > -1 : false;
		},

		'first-child': function(node){
			return this['pseudo:index'](node, 0);
		},

		'last-child': function(node){
			while ((node = node.nextSibling)){
				if (node.nodeType === 1) return false;
			}
			return true;
		},

		'only-child': function(node){
			var prev = node;
			while ((prev = prev.previousSibling)){
				if (prev.nodeType === 1) return false;
			}
			var next = node;
			while ((next = next.nextSibling)){
				if (next.nodeType === 1) return false;
			}
			return true;
		},

		'nth-child': function(node, argument){
			argument = (!argument) ? 'n' : argument;
			var parsed = this.cacheNTH[argument] || this.parseNTHArgument(argument);
			if (parsed.special != 'n') return this['pseudo:' + parsed.special](node, argument);
			if (parsed.a === 1 && parsed.b === 0) return true;
			var count = 0, uid = this.uidOf(node);
			if (!this.positions[uid]){
				while ((node = node.previousSibling)){
					if (node.nodeType !== 1) continue;
					count ++;
					var uis = this.uidOf(node);
					var position = this.positions[uis];
					if (position != null){
						count = position + count;
						break;
					}
				}
				this.positions[uid] = count;
			}
			return (this.positions[uid] % parsed.a === parsed.b);
		},

		// custom pseudos

		'index': function(node, index){
			var count = 0;
			while ((node = node.previousSibling)){
				if (node.nodeType === 1 && ++count > index) return false;
			}
			return (count === index);
		},

		'even': function(node, argument){
			return this['pseudo:nth-child'](node, '2n+1');
		},

		'odd': function(node, argument){
			return this['pseudo:nth-child'](node, '2n');
		}

	};
	for (var p in pseudos) local['pseudo:' + p] = pseudos[p];
	
	// Slick contains
	
	Slick.contains = local.contains;
	
	// add pseudos
	
	Slick.defineEngine = function(name, fn, shouldDefine){
		if (shouldDefine == null) shouldDefine = true;
		if (typeof shouldDefine == 'function') shouldDefine = shouldDefine.call(local);
		if (shouldDefine)
			local['customEngine:' + name] = local['customEngine:' + fn] || fn;
		return this;
	};
	
	// Slick.lookupEngine = function(name){
	// 	var engine = local['customEngine:' + name];
	// 	if (engine) return function(context, parsed){
	// 		return engine.call(this, context, parsed);
	// 	};
	// };
	
	Slick.defineEngine('className',function(context, parsed){
		this.found.push.apply(this.found,
			this.collectionToArray(
				context.getElementsByClassName( parsed.expressions[0][0].classes.join(' ') )
			)
		);
	},function(){
		return this.cachedGetElementsByClassName === false;
	});
	
	Slick.defineEngine('classNames','className');
	
	Slick.defineEngine('tagName',function(context, parsed){
		this.found.push.apply(this.found,
			this.collectionToArray(
				context.getElementsByTagName( parsed.expressions[0][0].tag )
			)
		);
	});
	
	Slick.defineEngine('tagName*','tagName', function(context, parsed){
		return !(this.starSelectsComments || this.starSelectsClosed || this.starSelectsClosedQSA);
	});
	
	Slick.defineEngine('XML:tagName','tagName');
	
	// Slick.defineEngine('id',function(context, parsed){
	// 	context = context.ownerDocument || context;
	// 	var el = context.getElementById(parsed.expressions[0][0].id)
	// 	this.found.push(  );
	// },function(){
	// 	return !this.idGetsName;
	// });
	
	// add pseudos
	
	Slick.definePseudo = function(name, fn){
		fn.displayName = "Slick Pseudo:" + name;
		name = 'pseudo:' + name;
		local[name] = function(node, argument){
			return fn.call(node, argument);
		};
		local[name].displayName = name;
		return this;
	};
	
	Slick.lookupPseudo = function(name){
		var pseudo = local['pseudo:' + name];
		if (pseudo) return function(argument){
			return pseudo.call(this, argument);
		};
	};
	
	// add attributes
	
	local.attributeMethods = {};
	
	Slick.defineAttribute = function(name, fn){
		local.attributeMethods[name] = fn;
		fn.displayName = "Slick Attribute:" + name;
		return this;
	};
	
	Slick.lookupAttribute = function(name){
		return local.attributeMethods[name];
	};
	
	Slick.defineAttribute('class', function(){
		return ('className'in this) ? this.className : this.getAttribute('class');
	}).defineAttribute('for', function(){
		return ('htmlFor' in this) ? this.htmlFor : this.getAttribute('for');
	}).defineAttribute('href', function(){
        return this.getAttribute('href', 2);
    });
	
	local.getAttribute = function(node, name){
		var method = this.attributeMethods[name];
		return (method) ? method.call(node) : node.getAttribute(name);
	};
	
	// matcher
	
	Slick.match = function(node, selector){
		if (!(node && selector)) return false;
		if (!selector || selector === node) return true;
		if (typeof selector != 'string') return false;
		local.positions = {};
		return local['match:node'](node, selector);
	};
	
	Slick.deepMatch = function(node, expression, context){
		// FIXME: FPO code only
		var nodes = Slick(context||document, expression);
		for (var i=0; i < nodes.length; i++){
			if (nodes[i] === node){
				return true;
			}
		}
		return false;
	};
	
	// Slick.reverseMatch = function(node, selector){
		
		// var selector = Slick.reverse(selector);
		
		// return Slick(node, );
	// };
	
	Slick.uniques = function(nodes, append){
		var uniques = {};
		if (!append) append = [];
		for (var i = 0, l = nodes.length; i < l; i++){
			var node = nodes[i], uid = local.uidOf(node);
			if (!uniques[uid]){
				uniques[uid] = true;
				append.push(node);
			}
		}
		return append;
	};
	
	// utils
	
	Slick.isXML = local.isXML;
	
	// debugging
	var displayName;
	for (displayName in local){
		if (typeof local[displayName] == 'function') local[displayName].displayName = displayName;
	}
	for (displayName in Slick){
		if (typeof Slick[displayName] == 'function') Slick[displayName].displayName = "Slick." + displayName;
	}
	
	// init
	
	Slick.setBrowser(document);
	Slick.setDocument(document);
	
	// public
	
	this.Slick = Slick;
	
}).apply(this);



/*
---
provides: SlickParser
description: Standalone CSS3 Selector parser

license: MIT-style

authors:
- Thomas Aylott
- Valerio Proietti
- Fabio M Costa
...
*/
(function(){
	
	function SlickParser(expression){
		return parse(expression);
	};
	
	var parsed,
		separatorIndex,
		combinatorIndex,
		partIndex,
		reversed,
		cache = {},
		reverseCache = {}
	;
	
	var parse = function(expression, isReversed){
		expression = String(expression);
		reversed = !!isReversed;
		var currentCache = (reversed) ? reverseCache : cache;
		if (currentCache[expression]) return currentCache[expression];
		var exp = expression;
		parsed = {Slick: true, simple: true, type: [], expressions: [], raw: expression, reverse: function(){
			return parse(this.raw, true);
		}};
		separatorIndex = -1;
		while (exp != (exp = exp.replace(regexp, parser)));
		parsed.length = parsed.expressions.length;
		return currentCache[expression] = (reversed) ? reverse(parsed) : parsed;
	};
	
	var reverseCombinator = function(combinator){
		if (combinator == '!') return ' ';
		else if (combinator == ' ') return '!';
		else if ((/^!/).test(combinator)) return combinator.replace(/^(!)/, '');
		else return '!' + combinator;
	};
	
	var reverse = function(expression){
		var expressions = expression.expressions;
		for (var i = 0; i < expressions.length; i++){
			var exp = expressions[i];
			var last = {parts: [], tag: '*', combinator: reverseCombinator(exp[0].combinator)};
			
			for (var j = 0; j < exp.length; j++){
				var cexp = exp[j];
				if (!cexp.reverseCombinator) cexp.reverseCombinator = ' ';
				cexp.combinator = cexp.reverseCombinator;
				delete cexp.reverseCombinator;
			}
			
			exp.reverse().push(last);
		}
		return expression;
	};
	
	var escapeRegExp = function(string){// Credit: XRegExp 0.6.1 (c) 2007-2008 Steven Levithan <http://stevenlevithan.com/regex/xregexp/> MIT License
		return string.replace(/[-[\]{}()*+?.\\^$|,#\s]/g, "\\$&");
	};
	
	var regexp = new RegExp(
		("(?x)^(?:"
		+"  \\s* ( , | $ ) \\s*         " // Separator
		+"| \\s* ( <combinator>+ ) \\s* " // Combinator
		+"|      ( \\s+ )               " // CombinatorChildren
		+"|      ( <unicode>+ | \\* )   " // Tag
		+"| \\#  ( <unicode>+       )   " // ID
		+"| \\.  ( <unicode>+       )   " // ClassName
		+"| \\[  ( <unicode>+       )(?: ([*^$!~|]?=) (?: \"((?:[^\"]|\\\")*)\" | '((?:[^']|\\')*)' | ([^\\]]*) )     )?  \\](?!\\])" // Attribute
		+"|   :+ ( <unicode>+       )(            \\( (?: \"((?:[^\"]|\\\")*)\" | '((?:[^']|\\')*)' | ([^\\)]*) ) \\) )?"             // Pseudo
		+")")
		.replace(/\(\?x\)|\s+#.*$|\s+/gim, '')
		.replace(/<combinator>/, '[' + escapeRegExp(">+~" + "`!@$%^&={}\\;</") + ']')
		.replace(/<unicode>/g, '(?:[\\w\\u00a1-\\uFFFF-]|\\\\[^\\s0-9a-f])')
	);
	
	var qsaCombinators = (/^(\s|[~+>])$/);
	
	var map = {
		rawMatch: 0,
		separator: 1,
		combinator: 2,
		combinatorChildren: 3,
		
		tagName: 4,
		id: 5,
		className: 6,
		
		attributeKey: 7,
		attributeOperator: 8,
		attributeValueDouble : 9,
		attributeValueSingle : 10,
		attributeValue: 11,
		
		pseudoClass: 12,
		pseudoClassArgs: 13,
		pseudoClassValueDouble : 14,
		pseudoClassValueSingle : 15,
		pseudoClassValue: 16
	};
	
	var rmap = {}; for (var p in map) rmap[map[p]] = p;
	
	function parser(){
		var a = arguments;
		
		var selectorBitMap, selectorBitName;
		
		for (var aN = 1; aN < a.length; aN++){
			if (a[aN]){
				selectorBitMap = aN;
				selectorBitName = rmap[selectorBitMap];
				break;
			}
		}
		
		if (!selectorBitName) return '';
		
		
		if (a[map.tagName]=='*') parsed.type.push('tagName*');
		
		else if (parsed.type[parsed.type.length-1] == selectorBitName && selectorBitName == 'className')
			parsed.type[parsed.type.length-1] = 'classNames';
		
		else if (parsed.type[parsed.type.length-1] == 'classNames' && selectorBitName == 'className');
		
		else parsed.type.push(selectorBitName);
		
		
		var isSeparator = selectorBitName == 'separator';
		
		if (isSeparator || separatorIndex == -1){
			parsed.expressions[++separatorIndex] = [];
			combinatorIndex = -1;
			if (isSeparator) return '';
		}
		
		var isCombinator = (selectorBitName == 'combinator') || (selectorBitName == 'combinatorChildren');
		
		if (isCombinator || combinatorIndex == -1){
			var combinator = a[map.combinator] || ' ';
			if (parsed.simple && !qsaCombinators.test(combinator)) parsed.simple = false;
			var currentSeparator = parsed.expressions[separatorIndex];
			if (reversed){
				if (currentSeparator[combinatorIndex]) currentSeparator[combinatorIndex].reverseCombinator = reverseCombinator(combinator);
			}
			currentSeparator[++combinatorIndex] = {combinator: combinator, tag: '*', id: null, parts: []};
			partIndex = 0;
			if (isCombinator) return '';
		}
		
		var currentParsed = parsed.expressions[separatorIndex][combinatorIndex];
		
		switch (selectorBitName){
		
		case 'tagName':
			currentParsed.tag = a[map.tagName];
			return '';
			
		case 'id':
			currentParsed.id = a[map.id];
			return '';
			
		case 'className':
			var className = a[map.className];
			
			if (!currentParsed.classes) currentParsed.classes = [className];
			else currentParsed.classes.push(className);
			
			currentParsed.parts[partIndex] = {
				type: 'class',
				value: className,
				regexp: new RegExp('(^|\\s)' + escapeRegExp(className) + '(\\s|$)')
			};
			
			break;
			
		case 'pseudoClass':
			parsed.simple = false;
			
			if (!currentParsed.pseudos) currentParsed.pseudos = [];
			
			currentParsed.pseudos.push(currentParsed.parts[partIndex] = {
				type: 'pseudo',
				key: a[map.pseudoClass],
				value: a[map.pseudoClassValueDouble] || a[map.pseudoClassValueSingle] || a[map.pseudoClassValue]
			});
			
			break;
			
		case 'attributeKey':
			parsed.simple = false;
			
			if (!currentParsed.attributes) currentParsed.attributes = [];
			
			var key = a[map.attributeKey];
			var operator = a[map.attributeOperator];
			var attribute = a[map.attributeValueDouble] || a[map.attributeValueSingle] || a[map.attributeValue] || '';
			
			var test, regexp;
			
			switch (operator){
			case '^=' : regexp = new RegExp(       '^'+ escapeRegExp(attribute)            ); break;
			case '$=' : regexp = new RegExp(            escapeRegExp(attribute) +'$'       ); break;
			case '~=' : regexp = new RegExp( '(^|\\s)'+ escapeRegExp(attribute) +'(\\s|$)' ); break;
			case '|=' : regexp = new RegExp(       '^'+ escapeRegExp(attribute) +'(-|$)'   ); break;
			case  '=' : test = function(value){ return attribute == value; }; break;
			case '*=' : test = function(value){ return value && value.indexOf(attribute) > -1; }; break;
			case '!=' : test = function(value){ return attribute != value; }; break;
			default   : test = function(value){ return !!value; };
			}
			
			if (!test) test = function(value){
				return value && regexp.test(value);
			};
			
			currentParsed.attributes.push(currentParsed.parts[partIndex] = {
				type: 'attribute',
				key: key,
				operator: operator,
				value: attribute,
				test: test
			});
			
			break;
		}
		
		partIndex++;
		return '';
	};
	
	for (var displayName in Slick){
		if (typeof Slick[displayName] == 'function') Slick[displayName].displayName = "Slick." + displayName;
	}
	
	// public
	
	if (this.Slick){
		
		this.Slick.parse = SlickParser;
		
		this.Slick.reverse = function(expression){
			return parse((typeof expression == 'string') ? expression : expression.raw, true);
		};
		
		this.Slick.parse.escapeRegExp = escapeRegExp;
	} else {
		this.SlickParser = SlickParser;
	}
	
}).apply(this);
