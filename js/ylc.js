/**
 * An event dispatching object
 */
var dispatcher = $({});

/**
 * Parse out the rightmost element from a URI
 * Understands paths and fragments
 * 
 * @param {Object} uri
 */
function lastURIElement(uri) {
	var lpe = uri.split('/').pop();
	return lpe.split('#').pop();
}

/**
 * Try to extract the best possible label from a result object
 * @param {Object} obj
 * @param {Object} key
 */
function getLabel(obj, key) {
	if (obj.hasOwnProperty(key + 'label')) {
		return obj[key + 'label'].value;
	} else {
		if (obj.hasOwnProperty(key)) {
			return lastURIElement(obj[key].value);
		} else {
			return 'Unknown';
		}
	}
}

/**
 * Calculate a width for a column.
 * Surely there's a better way... a table?
 * @param {Object} cols
 */
function calcCols(cols) {
	var c_width = $('#content').width();
	return Math.floor((c_width - (20 * cols))/cols);
}

/**
 * Return a comparator function to sort objects by the supplied property
 * NB descends to the 'value' key of the named property
 * 
 * @param {Object} prop_name
 */
function cmpFactory(prop_name) {
	var prop = prop_name;
	return function(a, b) {
		return b[prop].value - a[prop].value;
	};
}

/**
 * Find the appropriate measure fot the datastucture
 * 
 * @param {Object} dsd_obj
 */
function getMeasure(dsd_obj) {
	var measures = [];
	$.each(dsd_obj.structure, function(i,v){
		if (lastURIElement(v.type.value) === 'measure') {
	v.ob_key = 'm' + lastURIElement(v.variable.value);
		if (v.label) {
			v.title = v.label.value;
		} else {
			v.title = lastURIElement(v.variable.value);
		}
		measures.push(v);
	}
});

var measure = measures.pop();
if (measures.length > 1) {
	alert('Multiple measures found in dataset. "' + measure.title + '" has been chosen to draw this comparision');
	} 
	return measure;
	
}

/**
 * Returns an array which is a subset of arr where all items have 
 * the property prop and its value contains a value key whose value is
 * val... go figure...
 * @param {Object} arr
 * @param {Object} prop
 * @param {Object} val
 */
function yankItems(arr, prop, val) {
	var filter = function (p, v) {
		var prop = p;
		var val = v;
		return function(i,v){
			if (v[prop]) {
				if (v[prop].value == val) {
					return true;
				}
			}
			return false;
		};
	};
	var filtered = [];
	var ff = filter(prop, val);
	$.each(arr, function(i,v){
		if (ff(i, v)) {
			filtered.push(v);
		}
	});
	return filtered;
}

/**
 * Takes an array of objects and returns an object
 * grouping the originals under keys representing the values of the property
 * specified
 * @param {Object} arr
 * @param {Object} key
 */
function groupOn(arr, key) {
	var grouped = {};
	$.each(arr, function(i,v){
		if (!grouped.hasOwnProperty(v[key].value)) {
			grouped[v[key].value] = [];
		}
		grouped[v[key].value].push(v);
	});
	return grouped;
}

/**
 * Select a group of observations and
 * redraw the comparison
 * 
 * If the group is already in the selection it'll be removed
 * 
 * The number of selected groups is capped by
 * the global max_selected_groups
 * 
 * returns true if the group ends up selected false if not
 * 
 * @param {Object} group
 */
function toggleGroupSelection(group) {
	var pos = $.inArray(group, selected_groups);
	var old_selection = selected_groups.slice(0);
	switch (pos) {
		case -1:
			selected_groups.push(group);
			break;
		default:
			selected_groups.splice(pos, 1);
			break;
	}
	selected_groups = selected_groups.slice(-max_selected_groups);
	
	// Record the selected groups in the url fragment for permalinking
	var groups_fragment = [];
	$.each(selected_groups, function(i, g){
		groups_fragment.push({'d':g.data.observations[0].dataset.value, 'g':g.data.observations[0][ol_group_by].value});
	});
	jQuery.bbq.pushState({'select_groups':groups_fragment});

	
	$.each(old_selection.concat(selected_groups), function(i, v){
		var state = $.inArray(v, selected_groups) !== -1;
		$.each(v.nodes, function(i, node){
			updateSelectionUI(node, state);
		});
	});
	
	
	// Remove the hint once we've got one
	if (selected_groups.length === 0) {
		$('#status').slideDown();
		$('#visualisation').addClass('empty');
	} else {
		$('#status').slideUp();
		$('#visualisation').removeClass('empty');
	}
	
    drawComparison();
  }
  
  /**
   * Draw a google column visualisation using the current contents
   * of the selected_groups array
   */
  function drawComparison() {
  	// Utility to make a label continaing age range and sex
	var dimension_key = function (obj) {
	    return getLabel(obj, 'drefAge') + ' ' + getLabel(obj, 'dsex');
	};
	var data = new google.visualization.DataTable();
	data.addColumn('string', 'Age Range');
	var measure = {};

	if (selected_groups.length > 0) {
		//Find the measure by which to compare
		// Ask the user if we're not sure
		var measure = getMeasure(selected_groups[0].parent.data);

		// Loop over the data
		var stats = {cols:[], dimension:{}};
		$.each(selected_groups, function(i,v){
		    stats.cols.push(getLabel(v.data.observations[0], ol_group_by));
		    $.each(v.data.observations, function(i,v){
		        if (!stats.dimension.hasOwnProperty(dimension_key(v))) {
		            stats.dimension[dimension_key(v)] = {};
		        }
		        stats.dimension[dimension_key(v)][getLabel(v, ol_group_by)] = parseFloat(v[measure.ob_key].value);
		    });
		});

		$.each(stats.cols, function(i, v) {
		    data.addColumn('number', v);
		});

		var index = 0;
		$.each(stats.dimension, function(key, val){
		    data.addRows(1);
		    data.setValue(index, 0, key);
		    $.each(stats.cols, function(i,v){
		        data.setValue(index, i+1, val[v]);
		    });
		    index++;  
		});

		var chart = new google.visualization.ColumnChart(document.getElementById('visualisation'));
		chart.draw(data, {width: 600, height: 400, title: measure.title,
		               hAxis: {title: 'Age Range', titleTextStyle: {color: 'red'}}
		});
	} else {
		$('#visualisation').empty();
	}
}
  
/**
 * Handle any UI state changes when a group is selected or deselected
 * 
 * @param {Object} button
 * @param {Object} selected
 */
 function updateSelectionUI(elem, selected){
  	var elem = $(elem);
  	if (selected) {
		elem.button( "option", "label", "remove" );
		elem.button('option', 'icons', {primary:'ui-icon-circle-minus'});
		elem.parents('.group_header:first').addClass('selected');
  	} else {
  		elem.button( "option", "label", "add" );
  		elem.button('option', 'icons', {primary:'ui-icon-circle-plus'});
  		elem.parents('.group_header:first').removeClass('selected');
	}
 }
  
/**
* Run a suite of jqueryUI enhancements against an element and its contents
* @param {Object}elem
*/
function enhanceUI(elem) {
	// Buttonize
	$('.load', elem).button();
	$('button.group_select').button({icons:{primary:'ui-icon-circle-plus'},
                                                      text:true});
	$('.accordion').accordion({
	 	collapsible : true,
		active : false,
		clearStyle : true
	 });
  
	 $('#nav a.pop_toggle', elem).each(function(){
		 $(this).data('pop', $(this).next('.pop'));
		 $(this).bind('click', function(){
			 $($(this).data('pop')).dialog();
		 });
	 });
}

/**
 * Encode a sparql query for use against our endpoint proxy 
 * 
 * @param {Object} query
 */
function build_sparql_params(query, use_default_graph) {
	
	var prefixes = ['prefix qb: <http://purl.org/linked-data/cube#>',
                      'prefix yl: <http://data.younglives.org.uk/variables/>',
					  'prefix yls: <http://data.younglives.org.uk/statistics/>',
					  'prefix sdmx-dimension: <http://purl.org/linked-data/sdmx/2009/dimension#>',
					  'prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>',
					  'prefix skos: <http://www.w3.org/2004/02/skos/core#>'];

query = prefixes.join(' ') + ' ' + query; 
var format = 'application/sparql-results+json';
var graphURI = 'http://data.younglives.org.uk/';
var url = 'http://practicalparticipation.dyndns.org:8890/sparql?';
if (use_default_graph) {
	url += 'default-graph-uri=' + encodeURIComponent(graphURI);
} else {
	url += 'default-graph-uri='
url += '&should-sponge=grab-all-seealso';
} 
url += '&format=' + encodeURIComponent(format);
url += '&query=' + encodeURIComponent(query);

var params = {'mode':'native',
          'url':url};						  
	return params;
}

/**
 * Display a list of DSDs and the datasets which use them
 */
function getDSDs() {
    // Listing the dsds and datasets
	// Show a loader
	$('#content').html('<div class="loader"><img src="./images/loading.gif" /><br /><em>Retrieving Datacubes</em></div>')
	
	var query = 'SELECT ?dsd ?dsdlabel ?dsdcomment ?dataset ?datasetlabel ?datasetcomment WHERE {';
	query += '?dsd a qb:DataStructureDefinition .';
	query += '?dataset qb:structure ?dsd.';
	query += 'OPTIONAL {?dsd rdfs:label ?dsdlabel.}';
	query += 'OPTIONAL {?dsd rdfs:comment ?dsdcomment.}';
	query += 'OPTIONAL {?dataset rdfs:label ?datasetlabel.}';
	query += 'OPTIONAL {?dataset rdfs:comment ?datasetcomment.}';
	query += '} ';
                  
	$.getJSON(endpoint, build_sparql_params(query, true), 
     function(data){
         //Wrangle the data cos virtuoso won't GROUP BY
         dsds = {};
         $.each(data.results.bindings, function(i,v){
            if (!dsds.hasOwnProperty(v.dsd.value)) {
                dsds[v.dsd.value] = {'structure':[], 
									 'datasets':[], 
									 'dsd_uri':v.dsd.value,
									 'observations':[]};
				if (v.dsdlabel) {
					dsds[v.dsd.value].label = v.dsdlabel.value;
				}
				if (v.dsdcomment) {
                    dsds[v.dsd.value].comment = v.dsdcomment.value;
                }
            }
			
			// Have we got this dataset already?
			var ds_added = false;
			$.each(dsds[v.dsd.value].datasets, function(dex, res) {
				if (v.dataset.value == res.dataset.value) {
					ds_added = true;
				}
			});
			if (!ds_added) {
				dsds[v.dsd.value].datasets.push(v);
			}
            
         });
		 
		 //Set up bindings for the dsds
		 $('#dsds.accordion').live('accordionchange', function(event, ui){
		 	if (ui.newHeader.length !== 0) {
				var dsd_uri = $('span.uri', ui.newHeader).text();
                if (dsds[dsd_uri].structure.length === 0) {
                    loadDSD(dsd_uri, $('.dsd-elements', ui.newContent));
                }
			}
		 });
         // Build the content
		 $('#subtitle').text('Available Datacubes');
         $('#content').html($('#comparisonsTemplate').tmpl(dsds));     
		 // Add jqueryUI elements
		 enhanceUI($('#content'));
		 
		 //Notify the event coordinator
		 dispatcher.trigger('dsds_loaded_event');
         
      }
    );
}

/**
 * Load and display a dsd
 * 
 * @param {Object} dsd
 * @param {Object} output
 */
function loadDSD(dsd, output) {
    // Listing the dsds and datasets
	var query = 'SELECT ?variable ?label ?type WHERE {';
	query += '<' + dsd + '> qb:component ?component.';
	query += '?component ?type ?variable.';
	query += 'FILTER(?type !=qb:order)';
	query += 'OPTIONAL {?variable rdfs:label ?label.}';
	query += 'OPTIONAL {?component qb:order ?order.}';
	query += '} ';
	
	// Setup a binding for 'Load Data' buttons
	$('.load').live('click', function(){
		loadObservations($(this).tmplItem());
		return false;
	});
                  
	$.getJSON(endpoint, build_sparql_params(query, true), 
     function(data){
		dsds[dsd].structure = data.results.bindings;
		
		// Record the choice of dsd in a url fragment
		jQuery.bbq.pushState({'active_dsd':dsd});
		
	    output.html($('#dsdElementsTemplate').tmpl(dsds[dsd]));    
		//Reveal the relevant load button
		//$('button.load[value='+dsd+']').show();
		// THE ABOVE ATTR SELECTOR DOESN'T WORK IN IE7-. Something like below needed
		$.each($('.load'), function(i,v) {
			v = $(v);
			if (v.attr('value') === dsd) {
				v.show();
			}
		});
		
		// Notify the dispatcher
		dispatcher.trigger('structure_loaded_event');
	});
}

/**
 * Load observations conforming to the dsd provided
 * Categorise them by data set and draw the comparison interface
 * 
 * @param {Object} dsd_obj
 */
function loadObservations(dsd_obj){		
	var select = 'SELECT DISTINCT ?dataset ';
	var where = 'WHERE { ?obs a qb:Observation .';
	where += '?obs qb:dataSet ?dataset .';
	
	$.each(dsd_obj.data.structure, function(i, v){
		var var_name = lastURIElement(v.variable.value);
		switch (lastURIElement(v.type.value)) {
			case 'dimension':
				select += ' ?d' + var_name + ' ?d'+ var_name +'label ';
				where += '?obs <'+ v.variable.value +'> ?d' + var_name + '. ';
				where += 'OPTIONAL { ?d'+ var_name +' rdfs:label ?d'+ var_name +'label. } ';
				where += 'OPTIONAL { ?d'+ var_name +' skos:prefLabel ?d'+ var_name +'label. } ';
				break;
			case 'measure':
				select += ' ?m' + var_name;
				where += '?obs <' + v.variable.value + '> ?m' + var_name + '. ';
				break;
		}
	});

	where += ' }';

	var query = select + ' ' + where;
	
	$.getJSON(endpoint, build_sparql_params(query, false),
		function(data){

			
			$.each(data.results.bindings, function (i, v){
				dsds[dsd_obj.data.dsd_uri].observations.push(v);
			});
			$('h2#title').text('Comparing the data');
			$('#subtitle').text('Choose up to ' + max_selected_groups + ' areas to compare');
			$('div#status').show();
			var content = $('#comparisonViewTemplate').tmpl(dsds[dsd_obj.data.dsd_uri]);
			$('#content').html(content);
			enhanceUI($('#content'));
			$('.group_select').click(function(event){
	            toggleGroupSelection($(this).tmplItem());
	            //prevent this click from opening the containing accordion
	            event.stopImmediatePropagation();
	            event.preventDefault();     
	        });
			
			// Note that we've loaded observations 
			jQuery.bbq.pushState({'load_observations':true});
			
			// Notify the dispatcher
			dispatcher.trigger('observations_loaded_event');
		});
}

/**
 * Detect permalink fragments in the url and automate to suit
 * Sorry about this implementation - don't read it if you don't have to
 * @return
 */
function handle_permalinks() {
	var perma = jQuery.deparam.fragment();	
	if (perma.active_dsd) {
		// Show a loading modal
		var loader = $('<div class="loader" title="Loading Saved State"><img src="./images/loading.gif" /></div>').dialog({modal:true,  hide: {effect: "fadeOut", duration: 1000}});
		dispatcher.bind('permalink_load_chain_complete', function(){ loader.dialog('close'); });

		//Set up our loading chain
		dispatcher.bind('dsds_loaded_event', function(){		
			//Prepare the next chained listener to load observations
			dispatcher.bind('structure_loaded_event', function(){
				if (perma.load_observations) {
					// Be ready to select items for comparison if needed
					dispatcher.bind('observations_loaded_event', function(){
						if (perma.select_groups) {
							// Reverse the array so that we can easily build one in the same order
							// without upsetting IE by use of unshift()
							perma.select_groups.reverse();
							$.each(perma.select_groups, function(i, v){
								//Find the select button and trigger a click on it for each selected group
								// Surely we could build selected_groups and then 
								var ds = $('.dataset[title='+v.d+']');
								var group = $('.group_header[title='+v.g+']', ds);
								//$('.group_select', group).trigger('click');
								var item = $('.group_select', group).tmplItem();
								
								//Last one - cause a ui update
								if (i === perma.select_groups.length-1) {
									toggleGroupSelection(item);
								} else {
									selected_groups.push(item);
								}
							});
							// End of permalink chain
							dispatcher.trigger('permalink_load_chain_complete');
						
						} else {
							//There can be nothing more to do
							dispatcher.trigger('permalink_load_chain_complete');
						}
					});

					// fake up a templateItem
					var dsd_obj = {'data':dsds[perma.active_dsd]}
					loadObservations(dsd_obj);
				} else {
					dispatcher.trigger('permalink_load_chain_complete');
				}
			});
			
			// Trigger the accordion change on the element holding a ref to our active_dsd
			var accordion_el = $('#dsds.accordion');
			var active_index = null;
			$('.dsd-toggle .uri', accordion_el).each(function(i,v){
				if ($(v).text() == perma.active_dsd) {
					active_index = i;
				}
			});
			accordion_el.accordion('activate', active_index);
		});
		
		//Start the load chain
		getDSDs();
	} else {
		getDSDs();
	}
}
		
		
	
	
