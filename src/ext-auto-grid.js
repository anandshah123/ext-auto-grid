// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;
// Test & load required Ext grid packages only at once.
Ext.require(['Ext.data.*', 'Ext.grid.*']);
(function ($, window, document, undefined) {

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
            ready: function () {
            }
        };

    // The actual plugin constructor
    function Plugin(element, options) {
        this.element = element;
        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.settings = $.extend({}, defaults, options);
        this._defaults = defaults;
        this._name = pluginName;
        this.init();
    }

    // Avoid Plugin.prototype conflicts
    $.extend(Plugin.prototype, {
        init: function init() {
            // Saving this instance for inner use.
            var _this = this;

            if (_this.settings.fields.length == 0)
                $.ajax({
                    async: false,
                    url: this.settings.url,
                    success: function (json) {
                        if (json.page.totalElements > 0) {
                            // TODO:: prepare fields self. should we use meta data here?
                        }
                    }
                });

            // Create generic model with the fields in settings.
            Ext.define('Person', {
                extend: 'Ext.data.Model',
                fields: _this.settings.fields,
                validations: _this.settings.validations // Apply any validations if passed.
            });

            // Wait for the Extjs to be ready
            Ext.onReady(function () {

                // defining the store.
                _this.settings.store = Ext.create('Ext.data.Store', {
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
                                // Customizing Ext default writer to make it compatible with spring requests.
                                fn: function (data, request) {
                                    // do some manipulation of the unserialized data object
                                    if (request._records[0].data._links) {
                                        request._records[0].data.id = null; // Removing id assigned by Ext
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
                        write: function (store, operation) {
                            // Reload store if record is created successfully.
                            if (operation._response.status == 201) {
                                store.reload();
                            }
                        }
                    }
                });


                var rowEditing = Ext.create('Ext.grid.plugin.RowEditing', {
                    listeners: {
                        cancelEdit: function (rowEditing, context) {
                            // Canceling editing of a locally added, unsaved record: remove it
                            if (context.record.phantom) {
                                _this.settings.store.remove(context.record);
                            }
                        }
                    }
                });

                // initializing Ext cellediting plugin
                var cellEditing = Ext.create('Ext.grid.plugin.CellEditing', {
                    listeners: {
                        cancelEdit: function (cellEditing, context) {
                            // Canceling editing of a locally added, unsaved record: remove it
                            if (context.record.phantom) {
                                _this.settings.store.remove(context.record);
                            }
                        }
                    }
                });


                // Prepare Add button
                var addBtn = _this.settings.showAdd ? {
                    text: _this.settings.addBtnTitle,
                    iconCls: 'icon-add',
                    handler: _this.settings.addHandler ? _this.settings.addHandler(_this.settings.store, rowEditing) : function () {
                        var person = new Person();
                        person.id = 0;
                        person.data.id = 0;
                        _this.settings.store.insert(0, person);
                        rowEditing.startEdit(0, 0);
                    }} : {};

                // Prepare delete button
                var deleteBtn = _this.settings.showDelete ? {
                    itemId: 'delete',
                    text: _this.settings.deleteBtnTitle,
                    iconCls: 'icon-delete',
                    disabled: true,
                    handler: function () {
                        var selection = grid.getView().getSelectionModel().getSelection()[0];
                        if (selection) {
                            _this.settings.store.remove(selection);
                        }
                    }
                } : {};

                // Enable toolbar
                var dockEnable = _this.settings.showAdd || _this.settings.showDelete;
                var dockItems = [];
                if (_this.settings.showAdd) dockItems.push(addBtn);
                if (_this.settings.showDelete) {
                    dockItems.push('-');
                    dockItems.push(deleteBtn);
                }

                _this.settings.dockItems = dockItems;

                // Prepare final grid to display.
                var grid = Ext.create('Ext.grid.Panel', {
                    renderTo: _this.element,
                    plugins: (_this.settings.rowEditing ? [rowEditing] : (_this.settings.cellEditing ? [cellEditing] : null)),
                    width: _this.settings.width,
                    height: _this.settings.height,
                    frame: true,
                    title: _this.settings.title,
                    store: _this.settings.store,
                    iconCls: 'icon-user',
                    columns: _this.settings.columns,
                    // paging bar on the bottom
                    bbar: new Ext.PagingToolbar({
                        pageSize: 20,
                        store: _this.settings.store,
                        displayInfo: true,
                        emptyMsg: "No results to display"
                    }),
                    dockedItems: dockEnable ? [
                        {
                            xtype: 'toolbar',
                            items: dockItems
                        }
                    ] : false
                });

                // Save the grid instance in settings.
                _this.settings.grid = grid;

                // register call back on delete only if it is shown on UI
                if (_this.settings.showDelete)
                    grid.getSelectionModel().on('selectionchange', function (selModel, selections) {
                        grid.down('#delete').setDisabled(selections.length === 0);
                    });

                // Callback any registered functions with current instance.
                _this.settings.ready(_this);
            });

        },
        getGrid: function getGrid() {
            return this.settings.grid;
        },
        getStore: function getStore() {
            return this.settings.store;
        },
        getDockItems: function getDockItems() {
            return this.settings.dockItems;
        }
    });


    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations
    $.fn[ pluginName ] = function (options) {
        var plugin = $.data(this, "plugin_" + pluginName);
        this.each(function () {
            if (!plugin) {
                plugin = new Plugin(this, options);
                $.data(this, "plugin_" + pluginName, plugin);
            }
        });

        // chain jQuery functions
        return plugin;
    };

})(jQuery, window, document);