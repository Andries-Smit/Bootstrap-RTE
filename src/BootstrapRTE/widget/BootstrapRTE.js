/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console, dojo */
/*mendix */

require([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",

    "mxui/dom",
    "dojo/dom",
    "dojo/query",
    "dojo/dom-prop",
    "dojo/dom-geometry",
    "dojo/dom-class",
    "dojo/dom-style",
    "dojo/dom-attr",
    "dojo/dom-construct",
    "dojo/_base/array",
    "dojo/_base/lang",
    "dojo/text",
    "dojo/html",

    "dijit/focus",
    "dojo/fx",
    "dojo/fx/Toggler",
    "dojo/html",
    "dojo/_base/event",

    "BootstrapRTE/lib/jquery",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE.html",

    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_basic.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_dent.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_font.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_fontsize.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_html.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_justify.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_list_and_dent.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_list.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_picture.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_unredo.html",
    "dojo/text!BootstrapRTE/widget/template/BootstrapRTE_toolbar_url.html",

    "BootstrapRTE/lib/bootstrap-wysiwyg",
    "BootstrapRTE/lib/external/jquery.hotkeys"
], function (declare, _WidgetBase, _TemplatedMixin,
    dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domAttr, domConstruct, dojoArray,
    lang, text, dojoHtml, focusUtil, coreFx, Toggler, domHtml, domEvent, _jQuery,
    widgetTemplate,
    templateToolbarBasic,
    templateToolbarDent,
    templateToolbarFont,
    templateToolbarFontSize,
    templateToolbarHtml,
    templateToolbarJustify,
    templateToolbarListAndDent,
    templateToolbarList,
    templateToolbarPicture,
    templateToolbarUnredo,
    templateToolbarUrl
) {
    "use strict";

    var $ = _jQuery.noConflict(true);

    // Declare widget"s prototype.
    return declare("BootstrapRTE.widget.BootstrapRTE", [_WidgetBase, _TemplatedMixin], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // Parameters configured in the Modeler.
        attribute: "",
        showToolbarOnlyOnFocus: false,
        boxMinHeight: 100,
        boxMaxHeight: 600,
        onchangeMF: "",
        toolbarButtonFont: true,
        toolbarButtonFontsize: true,
        toolbarButtonEmphasis: true,
        toolbarButtonList: true,
        toolbarButtonDent: true,
        toolbarButtonJustify: true,
        toolbarButtonLink: true,
        toolbarButtonPicture: true,
        toolbarButtonDoRedo: true,
        toolbarButtonHtml: true,

        // Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: null,
        _contextObj: null,
        _readOnly: false,
        _setup: false,

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function () {
            // Uncomment next line to start debugging
            logger.level(logger.DEBUG);
            this._handles = [];
        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function () {
            logger.debug(this.id + ".postCreate");

            if (this.readOnly || this.get("disabled") || this.readonly) {
                this._readOnly = true;
            }

            // Check settings.
            if (this.boxMaxHeight < this.boxMinHeight) {
                logger.error(this.id + "Widget configuration error; Bootstrap RTE: Max size is smaller the Min Size");
            }

            // Setup widgets
            //this._setupWidget();
        },

        update: function (obj, callback) {

            if (this.readOnly || this.get("disabled") || this.readonly) {
                this._readOnly = true;
            }

            if (!this._setup) {
                this._setupWidget(lang.hitch(this, this.update, obj, callback));
                return;
            }

            logger.debug(this.id + ".update");

            if (obj) {
                this._mxObj = obj;

                // set the content on update
                domHtml.set(this._inputfield, this._mxObj.get(this.attribute));
                this._resetSubscriptions();
            } else {
                // Sorry no data no show!
                logger.warn(this.id + ".update - We did not get any context object!");
            }

            mendix.lang.nullExec(callback);
        },

        /**
         * Extra setup widget methods.
         * ======================
         */
        _setupWidget: function (callback) {
            logger.debug(this.id + "._setupWidget");
            this._setup = true;
            // To be able to just alter one variable in the future we set an internal variable with the domNode that this widget uses.
            this._wgtNode = this.domNode;

            domAttr.remove(this.domNode, "focusindex");

            this._createChildNodes();
            this._setupEvents();

            mendix.lang.nullExec(callback);
        },

        // Create child nodes.
        _createChildNodes: function () {
            logger.debug(this.id + "._createChildNodes");
            // Create input field.
            this._inputfield = dom.create("div", {
                "id": this.id + "_editor",
                "tabindex": 0,
                "focusindex": 0
            });

            // Created toolbar and editor.
            this._createToolbar();
            this._addEditor();
        },

        // Attach events to newly created nodes.
        _setupEvents: function () {
            logger.debug(this.id + "._setupEvents");
            var self = this,
                handleFocus = null,
                inFocus = null;

            if (this.showToolbarOnlyOnFocus) {
                domStyle.set(this._toolbarNode, "display", "none"); //Maybe box is first in tab order, does this need to be checked?

                this._isToolbarDisplayed = false;

                this._toggler = new Toggler({
                    node: self._toolbarNode,
                    showFunc: coreFx.wipeIn,
                    hideFunc: coreFx.wipeOut
                });

                handleFocus = $(this.domNode).on("click", lang.hitch(this, function (event) {
                    inFocus = this._inFocus(this.domNode, event.target);
                    if (inFocus && !this._isToolbarDisplayed) {
                        this._toggler.show();
                        this._isToolbarDisplayed = true;
                    } else if (!inFocus && this._isToolbarDisplayed) {
                        this._toggler.hide();
                        this._isToolbarDisplayed = false;
                    }
                }));

            }
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            if (this._handles.length > 0) {
                dojoArray.forEach(this._handles, function (handle) {
                    mx.data.unsubscribe(handle);
                });
                this._handles = null;
            }
            if (!this._handles) {
                this._handles = [];
            }

            // fix microflow change calls
            var handle = mx.data.subscribe({
                    guid: this._mxObj.getGuid(),
                    callback: lang.hitch(this, this._loadData)
                }),
                // set the validation handle.
                validationHandle = mx.data.subscribe({
                    guid: this._mxObj.getGuid(),
                    val: true,
                    callback: lang.hitch(this, this._handleValidation)
                });

            this._handles.push(handle);
            this._handles.push(validationHandle);
        },

        /**
         * Interaction widget methods.
         * ======================
         */
        _inFocus: function (node, newValue) {
            logger.debug(this.id + "._inFocus");
            var nodes = null,
                i = 0;
            if (newValue) {
                nodes = $(node).children().andSelf();
                for (i = 0; i < nodes.length; i++) {
                    if (nodes[i] === $(newValue).closest(nodes[i])[0]) {
                        return true;
                    }
                }
            } else {
                return false;
            }
        },

        _loadData: function () {
            logger.debug(this.id + "._loadData");
            // Set the html of the inputfield after update!
            domHtml.set(this._inputfield, this._mxObj.get(this.attribute));
        },

        /**
         * Custom widget functions
         */

        _createToolbar: function () {
            logger.debug(this.id + "._createToolbar");
            //Create toolbar node.
            this._toolbarNode = dom.create("div", {
                "class": "btn-toolbar toolbar_" + this.id,
                "data-role": "editor-toolbar-" + this.id,
                "data-target": "#" + this.id + "_editor"
            });

            //Load templates
            if (this.toolbarButtonFont) {
                domConstruct.place(domConstruct.toDom(templateToolbarFont), this._toolbarNode);
            }

            if (this.toolbarButtonFontsize) {
                domConstruct.place(domConstruct.toDom(templateToolbarFontSize), this._toolbarNode);
            }

            if (this.toolbarButtonEmphasis) {
                domConstruct.place(domConstruct.toDom(templateToolbarBasic), this._toolbarNode);
            }
            if (this.toolbarButtonList && this.toolbarButtonDent) {
                domConstruct.place(domConstruct.toDom(templateToolbarListAndDent), this._toolbarNode);
            } else if (this.toolbarButtonList) {
                domConstruct.place(domConstruct.toDom(templateToolbarList), this._toolbarNode);
            } else if (this.toolbarButtonDent) {
                domConstruct.place(domConstruct.toDom(templateToolbarDent), this._toolbarNode);
            }

            if (this.toolbarButtonJustify) {
                domConstruct.place(domConstruct.toDom(templateToolbarJustify), this._toolbarNode);
            }

            if (this.toolbarButtonLink) {
                var template = domConstruct.toDom(templateToolbarUrl),
                    urlfield = domQuery("input", template)[0];
                domConstruct.place(template, this._toolbarNode);

                this.connect(urlfield, "click", function(e){
                    var target = e.currentTarget || e.target;
                    target.focus();
                    domEvent.stop(e);
                });
            }

            if (this.toolbarButtonPicture) {
                domConstruct.place(domConstruct.toDom(templateToolbarPicture), this._toolbarNode);
            }

            if (this.toolbarButtonHtml) {
                domConstruct.place(domConstruct.toDom(templateToolbarHtml), this._toolbarNode);
            }

            if (this.toolbarButtonDoRedo) {
                domConstruct.place(domConstruct.toDom(templateToolbarUnredo), this._toolbarNode);
            }
        },

        _addEditor: function () {
            logger.debug(this.id + "._addEditor");
            domConstruct.place(this._toolbarNode, this.domNode);
            domConstruct.place(this._inputfield, this.domNode, "last");

            //force the MX-styles.
            domClass.add(this._inputfield, "form-control mx-bootstrap-textarea mx-textarea-input mx-textarea-input-noresize");
            domStyle.set(this._inputfield, {
                "min-height": this.boxMinHeight + "px",
                "max-height": this.boxMaxHeight + "px"
            });

            $("#" + this.id + "_editor").wysiwyg({
                toolbarSelector: "[data-role=editor-toolbar-" + this.id + "]"
            });

            if (this._readOnly) {
                $("#" + this.id + "_editor").attr("contenteditable", "false");
                $(".toolbar_" + this.id).find("a").addClass("disabled");
            }

            this._addListeners();
        },

        _addListeners: function () {
            logger.debug(this.id + "._addListeners");
            var self = this,
                target = null;

            this.connect(this._inputfield, "blur", lang.hitch(this, function (e) {
                if (!this._readOnly) {
                    this._fetchContent();
                }
            }));

            //Ok, I"m just going to stick to jquery here for traversing the dom. Much easier.
            $("#" + this.id + " .dropdown-toggle").on("click", function (e) {
                $(this).parent().find("div").toggle();
                $(this).parent().find("ul").toggle();
                $(this).parent().find("input").focus();
            });

            //Check if we have to hide the dropdown box.
            this.connect(this.domNode, "click", function (e) {
                var isContainer = self._testTarget(e);
                if (!isContainer) {
                    domQuery("#" + this.id + " .dropdown-menu").style({
                        "display": "none"
                    });
                }
            });
        },

        _fetchContent: function () {
            logger.debug(this.id + "._fetchContent");
            var text = $(this._inputfield).html(),
                _valueChanged = (this._mxObj && this._mxObj.get(this.attribute) !== text);

            this._mxObj.set(this.attribute, text);

            if (_valueChanged) {
                this._clearValidations();
            }

            if (_valueChanged && this.onchangeMF !== "") {
                this._execMF(this._mxObj, this.onchangeMF);
            }

        },

        _execMF: function (obj, mf) {
            logger.debug(this.id + "._execMF", mf);
            if (mf) {
                var params = {
                    applyto: "selection",
                    actionname: mf,
                    guids: []
                };
                if (obj) {
                    params.guids = [obj.getGuid()];
                }
                mx.data.action({
                    store: {
                        caller: this.mxform
                    },
                    params: params
                }, this);
            }
        },

        _testTarget: function (e) {
            logger.debug(this.id + "._testTarget");
            //See if we clicked the same button
            var isButton = false,
                isContainer = {},
                value = {};

            dojoArray.forEach(domQuery("#" + this.id + " .dropdown-toggle"), function (object, index) {
                if (!isButton) {
                    isButton = $(e.target).parent()[0] === object || $(e.target) === object;
                }
            });

            //See if we clicked inside the box
            isContainer = $(e.target).closest("ul").children(".dropdown-toggle").length > 0 ||
                $(e.target).children(".dropdown-toggle").length > 0 ||
                $(e.target).parent().children(".dropdown-toggle").length > 0;

            value = isContainer;
            if (isButton === true) {
                value = isButton;
            }

            return value;
        },

        // Handle validations.
        _handleValidation: function(validations) {
            logger.debug(this.id + "._handleValidation");
            this._clearValidations();

            var validation = validations[0],
                message = validation.getReasonByAttribute(this.attribute);

            if (message) {
                this._addValidation(message);
                validation.removeAttribute(this.attribute);
            }
        },

        // Clear validations.
        _clearValidations: function() {
            logger.debug(this.id + "._clearValidations");
            domClass.toggle(this.domNode, "has-error", false);
            domConstruct.destroy(this._alertDiv);
            this._alertDiv = null;
        },

        // Show an error message.
        _showError: function(message) {
            logger.debug(this.id + "._showError");
            if (this._alertDiv !== null) {
                dojoHtml.set(this._alertDiv, message);
                return true;
            }
            this._alertDiv = domConstruct.create("div", {
                "class": "alert alert-danger",
                "innerHTML": message
            });
            domConstruct.place(this._alertDiv, this.domNode);
            domClass.toggle(this.domNode, "has-error", true);
        },

        // Add a validation.
        _addValidation: function(message) {
            logger.debug(this.id + "._addValidation");
            this._showError(message);
        }
    });
});
