// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ( $, window, document, undefined ) {

		// undefined is used here as the undefined global variable in ECMAScript 3 is
		// mutable (ie. it can be changed by someone else). undefined isn't really being
		// passed in so we can ensure the value of it is truly undefined. In ES5, undefined
		// can no longer be modified.

		// window and document are passed through as local variable rather than global
		// as this (slightly) quickens the resolution process and can be more efficiently
		// minified (especially when both are regularly referenced in your plugin).

		// Create the defaults once
		var pluginName = "extAutoGrid",
				defaults = {
				showAdd: true,
				showDelete: true,
				cellEditing: true,
				rowEditing: false,
				fields: [],
				columns: [],
				validations: null,
				url: '#',
				width: 500,
				height: 300,
				title: 'No title',
				addHandler: null,
				root: '_embedded',
				addBtnTitle: 'Add',
				deleteBtnTitle: 'Delete',
				grid: null,
				store: null,
				dockItems: null,
				ready: function(){}
		};

		// The actual plugin constructor
		function Plugin ( element, options ) {
				this.element = element;
				// jQuery has an extend method which merges the contents of two or
				// more objects, storing the result in the first object. The first object
				// is generally empty as we don't want to alter the default options for
				// future instances of the plugin
				this.settings = $.extend( {}, defaults, options );
				this._defaults = defaults;
				this._name = pluginName;
				this.init();
		}

		// Avoid Plugin.prototype conflicts
		$.extend(Plugin.prototype, {
				init: function () {
						var _this = this;
						// Place initialization logic here
						// You already have access to the DOM element and
						// the options via the instance, e.g. this.element
						// and this.settings
						// you can add more functions like the one below and
						// call them like so: this.yourOtherFunction(this.element, this.settings).
						Ext.require(['Ext.data.*', 'Ext.grid.*']);
						
						if(_this.settings.fields.length == 0)
							$.ajax({
								async: false,
								url: this.settings.url,
								type: 'GET',
								success: function(json){
									if(json.page.totalElements > 0){
										// TODO:: prepare fields self.
									}
								}
							});
						
						Ext.define('Person', {
						    extend: 'Ext.data.Model',
						    fields: _this.settings.fields,
						    validations: _this.settings.validations
						});

						Ext.onReady(function(){

						    var store = Ext.create('Ext.data.Store', {
						        autoLoad: true,
						        autoSync: true,
						        model: 'Person',
						        proxy: {
						            type: 'rest',
						            url: _this.settings.url,
						            reader: {
						                type: 'json',
						                root: _this.settings.root,
						                totalProperty: 'page.totalElements'
						            },
						            writer: {
						                type: 'json',
						                transform: {
	                                         fn: function(data, request) {
	                                             // do some manipulation of the unserialized data object
	                                        	if(request._records[0].data._links){
	                                        		request._records[0].data.id = null;
	 						                		request._url = request._records[0].data._links.self.href;
	 						                	}
	 						                	
	                                            return request._records[0].data;
	                                         },
	                                         scope: this
						              }
						            }
						        },
						        pageSize: 20,
						        listeners: {
						        	write: function(store, operation){
						            	if(operation._response.status == 201){
						            		store.reload();
						            	}
						            }
						        }
						    });
						    
						    _this.settings.store = store;
						    
						    var rowEditing = Ext.create('Ext.grid.plugin.RowEditing', {
						        listeners: {
						            cancelEdit: function(rowEditing, context) {
						                // Canceling editing of a locally added, unsaved record: remove it
						                if (context.record.phantom) {
						                    store.remove(context.record);
						                }
						            }
						        }
						    });
						    
						    var cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
						        listeners: {
						            cancelEdit: function(cellEditing, context) {
						                // Canceling editing of a locally added, unsaved record: remove it
						                if (context.record.phantom) {
						                    store.remove(context.record);
						                }
						            }
						        }
						    });
						   
						    
						    var addBtn = _this.settings.showAdd ? {
				                text: _this.settings.addBtnTitle,
				                iconCls: 'icon-add',
				                handler: _this.settings.addHandler ? _this.settings.addHandler(store,rowEditing) : function(){
				                	var person = new Person();
				                	person.id = 0;
				                	person.data.id = 0;
				                    store.insert(0, person);
				                    rowEditing.startEdit(0, 0);
				                }} : {};
				                
				             var deleteBtn = _this.settings.showDelete ? {
					                itemId: 'delete',
					                text: _this.settings.deleteBtnTitle,
					                iconCls: 'icon-delete',
					                disabled: true,
					                handler: function(){
					                    var selection = grid.getView().getSelectionModel().getSelection()[0];
					                    if (selection) {
					                        store.remove(selection);
					                    }
					                }
					            } : {};
					            
					            var dockEnable = _this.settings.showAdd || _this.settings.showDelete;
					            var dockItems = [];
					            if(_this.settings.showAdd) dockItems.push(addBtn);
					            if(_this.settings.showDelete){
					            	dockItems.push('-');
					            	dockItems.push(deleteBtn);
					            }
					            
					            _this.settings.dockItems = dockItems;
					            
						    var grid = Ext.create('Ext.grid.Panel', {
						        renderTo: _this.element,
						        plugins: (_this.settings.rowEditing ? [rowEditing] : (_this.settings.cellEditing ? [cellEditing] : null)),
						        width: _this.settings.width,
						        height: _this.settings.height,
						        frame: true,
						        title: _this.settings.title,
						        store: store,
						        iconCls: 'icon-user',
						        columns: _this.settings.columns,
						        // paging bar on the bottom
						        bbar: new Ext.PagingToolbar({
						            pageSize: 20,
						            store: store,
						            displayInfo: true,
						            emptyMsg: "No results to display"
						        }),
						        dockedItems: dockEnable ? [{
						            xtype: 'toolbar',
						            items: dockItems
						        }]: false
						    });
						    
						    _this.settings.grid = grid;
						    
						    if(_this.settings.showDelete)
							    grid.getSelectionModel().on('selectionchange', function(selModel, selections){
							        grid.down('#delete').setDisabled(selections.length === 0);
							    });
						    
						    _this.settings.ready(_this);
						});
						
				},
				getGrid: function(){
					return this.settings.grid;
				},
				getStore: function(){
					return this.settings.store;
				},
				getDockItems: function(){
					return this.settings.dockItems;
				}
		});

		
		// A really lightweight plugin wrapper around the constructor,
		// preventing against multiple instantiations
		$.fn[ pluginName ] = function ( options ) {
				var plugin = $.data( this, "plugin_" + pluginName );
				this.each(function() {
					if ( !plugin ) {
						plugin = new Plugin( this, options );
						$.data( this, "plugin_" + pluginName, plugin );
					}
				});

				// chain jQuery functions
				return plugin;
		};

})( jQuery, window, document );