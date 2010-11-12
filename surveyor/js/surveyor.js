/** Young Lives Demo **/

//Make our global and jqueryify it so that it can be used as an event dispatcher
var yl = {viz:null,
                question_pool:{},
				question_order:[],
			    data_objects:{},
				json_tree:{}};
var icicle = yl.viz;




yl.populate_questions = function () {
	yl.question_pool = {"Which gender are you?":["Male","Female"],
                                       "At what age did you first have sex?":["11","12","13","14","15","16","17","Declined to answer"],
                                       "Have you had to go without food in the last year?":["Yes","No","Declined to answer"],
                                       "Do You feel able to speak about your views and feelings with your parents/guardians?":["Yes","No","Declined to answer"],
                                       "During your life, have you ever tried drugs like marijuana?":["Yes","No","Declined to answer"]};
	for (var question in yl.question_pool) {
		$('#question_chooser').append('<option value="'+question+'">'+question+'</option>');
	}
	
	$('#question_chooser').bind('change', yl.question_chosen);
}

yl.question_chosen = function(event) {
	var question = event.currentTarget.value;
	var question_elem = $('<li><strong>'+question+'</strong><a href="#">remove</a></li>');
	question_elem.data('yl.question', question);
	$('#question_order').append(question_elem);
	$('a', question_elem).click(function(){var that = $(this);
	                                                             $(this).parent().fadeOut(500, function(){
																 	$(that).parent().remove();
																 })});
}

yl.gen_test_data = function () {
	//Generate testing objects
	var objects = {};
    var total = 655;
    for (var i = 1; i<=total;i++) {
        var obj = {};
        for (var q in yl.question_pool) {
            obj[q] = yl.question_pool[q][Math.floor(Math.random()*yl.question_pool[q].length)]
        }
        objects[i.toString()] = obj;
    }
	return objects;
}

yl.populate_json_tree = function(){
	//Create Json
    // Top Level
	var total_objects = 0;
	for (k in yl.data_objects) {
		if (yl.data_objects.hasOwnProperty(k)) 
			total_objects++;
	}

    var json_tree = {"id":"top",
                 "name":"All 655 Respondants",
                 "data": {"$area":total_objects,
                               "$dim":total_objects,
                               "$color":"#FF6600"},
                "question":null,
                "answer":null,
                "children":[]};
    // Loop through the data objects creating buckets for each question
    for (obj_id in yl.data_objects) {
        var trail = [json_tree];
        for (var qi =0; qi<yl.question_order.length;qi++) {
            var question = yl.question_order[qi];
            var answer = yl.data_objects[obj_id][question];
            if (answer === undefined) {
                // Do missing answer
            } else {
                // Find and increment the count at this question level
                var answer_object_at_level = null;
                for (var i=0;i<trail[qi]['children'].length;i++) {
                    if (trail[qi]['children'][i]['name'] === answer) {
                        trail[qi]['children'][i]['data']['$area']++;
                        trail[qi]['children'][i]['data']['$dim']++;
                        answer_object_at_level = trail[qi]['children'][i];
                    }
                }
                // Or initialize a new one
                if (!answer_object_at_level) {
                    // Generate a unique id for the new node - it identifies the 
                    // path through the tree to this point
                    var node_id = '';
                    for (var i=0;i<trail.length;i++) {
                        node_id += trail[i]['id'];
                    }
                    node_id += (question+answer);
                    
                    answer_object_at_level = {"id":node_id,
                                                                "name":answer,
                                                                "data": {"$area":1,
                                                                              "$dim":1,
                                                                              "$color":"#001eff",
                                                                              "$question":question},
                                                                 "question":question,
                                                                 "answer":answer,
                                                                 "children":[]};
                    trail[qi]['children'].push(answer_object_at_level );
                }
                // Put this answer object into our trail for the next
                // question level
                trail.push(answer_object_at_level);
            }
            
        }
    }
	yl.json_tree = json_tree;
}

yl.sort_and_color = function(obj) {
	var act = function (parent, children) {
		//First sort the children by name
		parent['children'] = children.sort(function(a,b){
			var aname = a['name'].toLowerCase(), bname = b['name'].toLowerCase();
			if (aname < bname) {return -1}
			if (aname > bname) {return 1}
			return 0 //default no sort
		});
		
		var pcolor = new Hex(parent['data']['$color']);
		var split = pcolor.analogous();
		var strip = split[0].range(split[1], children.length, true);
		for (var i=0; i<parent['children'].length;i++) {
			parent['children'][i]['data']['$color'] = '#' + strip[i].hex;
		}
		
		//now recurse
		for (var i=0; i<parent['children'].length;i++) {
			act(parent['children'][i], parent['children'][i]['children']);
		}
	}
	
	act(obj, obj['children']);
}

yl.init = function(){

	yl.populate_questions();
	
	// Build some sample data
	yl.data_objects = yl.gen_test_data();
	
	// Bind to our show me button
	$('#build').bind('click', yl.build_viz);
	
}

yl.get_question_order = function() {
	var qo = [];
	jQuery.each($('#question_order > li'), function(i,v) {
		qo.push($(v).data('yl.question'));
	});
	yl.question_order = qo;
}

yl.build_viz = function() {
	
	yl.get_question_order();
	yl.populate_json_tree();
	yl.sort_and_color(yl.json_tree);
	
	if (icicle) {
		icicle = null;
		$('#infovis').empty();
	}
	
	    //Build Visualisation
	    icicle = new $jit.Icicle({
	        // id of the visualization container  
	        injectInto: 'infovis',
	        // whether to add transition animations  
	        animate: true,
	        // nodes offset  
	        offset: 1,
	        // whether to add cushion type nodes  
	        cushion: true,
	        //show only three levels at a time  
	        constrained: true,
	        levelsToShow: 2,
	        // enable tips  
	        Tips: {
	            enable: true,
	            type: 'Native',
	            // add positioning offsets  
	            offsetX: 20,
	            offsetY: 20,
	            // implement the onShow method to  
	            // add content to the tooltip when a node  
	            // is hovered  
	            onShow: function(tip, node){
	                // count children  
	                var count = 0;
	                node.eachSubnode(function(){
	                    count++;
	                });
	                // add tooltip info  
	                tip.innerHTML = "<div class=\"tip-title\"><b>Answer:</b> " + node.name +
	                "</div><div class=\"tip-text\">" +
	                node.data['$area'] +
	                " people</div>";
	            }
	        },
	        // Add events to nodes  
	        Events: {
	            enable: true,
	            onMouseEnter: function(node){
	                //add border and replot node  
	                node.setData('border', '#33dddd');
	                icicle.fx.plotNode(node, icicle.canvas);
	                icicle.labels.plotLabel(icicle.canvas, node, icicle.controller);
	            },
	            onMouseLeave: function(node){
	                node.removeData('border');
	                icicle.fx.plot();
	            },
	            onClick: function(node){
	                if (node) {
	                    //hide tips and selections  
	                    icicle.tips.hide();
	                    if (icicle.events.hoveredNode) 
	                        this.onMouseLeave(icicle.events.hoveredNode);
	                    //perform the enter animation  
	                    icicle.enter(node);
	                }
	            },
	            onRightClick: function(){
	                //hide tips and selections  
	                icicle.tips.hide();
	                if (icicle.events.hoveredNode) 
	                    this.onMouseLeave(icicle.events.hoveredNode);
	                //perform the out animation  
	                icicle.out();
	            }
	        },
	        // Add canvas label styling  
	        Label: {
	            type: "HTML" // "Native" or "HTML"  
	        },
	        // Add the name of the node in the corresponding label  
	        // This method is called once, on label creation and only for DOM and not  
	        // Native labels.  
	        onCreateLabel: function(domElement, node){
	            var question = node.data['$question'];
	            if (question === undefined) { question = '';}
	            var html = '<div style="padding-top:30%"><em>'+question+'</em><br/><strong>'+node.name+'</strong></div>';
	            domElement.innerHTML = html;
	            var style = domElement.style;
	            style.fontSize = '1.2em';
	            style.display = '';
	            style.cursor = 'pointer';
	            style.color = '#333';
	            style.overflow = 'hidden';
	        },
	        // Change some label dom properties.  
	        // This method is called each time a label is plotted.  
	        onPlaceLabel: function(domElement, node){
	            var style = domElement.style, width = node.getData('width'), height = node.getData('height');
	            if (width < 7 || height < 7) {
	                style.display = 'none';
	            }
	            else {
	                style.display = '';
	                style.width = width + 'px';
	                style.height = height + 'px';
	                
	            }
	        }
	    });
	    icicle.layout.orientation = 'vertical';
	    icicle.loadJSON(yl.json_tree);
	    icicle.refresh();
	
	
	
};
