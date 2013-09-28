/*global define*/
define([
        '../Core/Cartesian3',
        '../Core/Color',
        '../Core/defaultValue',
        '../Core/defined',
        '../Core/DeveloperError',
        '../Core/destroyObject',
        '../Core/GeometryInstance',
        '../Core/PolygonGeometry',
        '../Core/ColorGeometryInstanceAttribute',
        '../Core/ShowGeometryInstanceAttribute',
        './ConstantProperty',
        './ColorMaterialProperty',
        './DynamicObjectCollection',
        '../Scene/Primitive',
        '../Scene/PerInstanceColorAppearance',
        '../Scene/Polygon',
        '../Scene/Material',
        './MaterialProperty'
       ], function(
         Cartesian3,
         Color,
         defaultValue,
         defined,
         DeveloperError,
         destroyObject,
         GeometryInstance,
         PolygonGeometry,
         ColorGeometryInstanceAttribute,
         ShowGeometryInstanceAttribute,
         ConstantProperty,
         ColorMaterialProperty,
         DynamicObjectCollection,
         Primitive,
         PerInstanceColorAppearance,
         Polygon,
         Material,
         MaterialProperty) {
    "use strict";

    var HashMap = function() {
        this._array = [];
        this._hash = {};
    };

    HashMap.prototype.contains = function(id) {
        return this._hash[id] !== 'undefined';
    };

    HashMap.prototype.add = function(value) {
        this._hash[value.id] = value;
        this._array.push(value);
    };

    HashMap.prototype.remove = function(value) {
        var hasValue = defined(this._hash[value.id]);
        if (hasValue) {
            var array = this._array;
            this._hash[value.id] = undefined;
            array.splice(array.indexOf(value), 1);
        }
        return hasValue;
    };

    HashMap.prototype.getArray = function() {
        return this._array;
    };

    var emptyArray = [];

    /**
     * A DynamicObject visualizer which maps the DynamicPolygon instance
     * in DynamicObject.polygon to a Polygon primitive.
     * @alias DynamicPolygonVisualizer
     * @constructor
     *
     * @param {Scene} scene The scene the primitives will be rendered in.
     * @param {DynamicObjectCollection} [dynamicObjectCollection] The dynamicObjectCollection to visualize.
     *
     * @exception {DeveloperError} scene is required.
     *
     * @see DynamicPolygon
     * @see Scene
     * @see DynamicObject
     * @see DynamicObjectCollection
     * @see CompositeDynamicObjectCollection
     * @see VisualizerCollection
     * @see DynamicBillboardVisualizer
     * @see DynamicConeVisualizer
     * @see DynamicConeVisualizerUsingCustomSensorr
     * @see DynamicLabelVisualizer
     * @see DynamicPointVisualizer
     * @see DynamicPolylineVisualizer
     * @see DynamicPyramidVisualizer
     *
     */
    var DynamicPolygonVisualizer = function(scene, dynamicObjectCollection) {
        if (!defined(scene)) {
            throw new DeveloperError('scene is required.');
        }

        this._scene = scene;
        this._primitives = scene.getPrimitives();
        this._dynamicObjectCollection = undefined;
        this._addedObjects = new DynamicObjectCollection();
        this._removedObjects = new DynamicObjectCollection();

        this._colorGeometries = new HashMap();
        this._colorPrimitive = undefined;

        this._unusedPolygons = [];
        this._dynamicPolygons = {};

        this.setDynamicObjectCollection(dynamicObjectCollection);
    };

    /**
     * Returns the scene being used by this visualizer.
     *
     * @returns {Scene} The scene being used by this visualizer.
     */
    DynamicPolygonVisualizer.prototype.getScene = function() {
        return this._scene;
    };

    /**
     * Gets the DynamicObjectCollection being visualized.
     *
     * @returns {DynamicObjectCollection} The DynamicObjectCollection being visualized.
     */
    DynamicPolygonVisualizer.prototype.getDynamicObjectCollection = function() {
        return this._dynamicObjectCollection;
    };

    /**
     * Sets the DynamicObjectCollection to visualize.
     *
     * @param dynamicObjectCollection The DynamicObjectCollection to visualizer.
     */
    DynamicPolygonVisualizer.prototype.setDynamicObjectCollection = function(dynamicObjectCollection) {
        var oldCollection = this._dynamicObjectCollection;
        if (oldCollection !== dynamicObjectCollection) {
            if (defined(oldCollection)) {
                oldCollection.collectionChanged.removeEventListener(DynamicPolygonVisualizer.prototype.onCollectionChanged, this);
                this.removeAllPrimitives();
            }
            this._dynamicObjectCollection = dynamicObjectCollection;
            if (defined(dynamicObjectCollection)) {
                dynamicObjectCollection.collectionChanged.addEventListener(DynamicPolygonVisualizer.prototype.onCollectionChanged, this);
                this.onCollectionChanged(dynamicObjectCollection, dynamicObjectCollection.getObjects(), emptyArray);
            }
        }
    };

    /**
     * Updates all of the primitives created by this visualizer to match their
     * DynamicObject counterpart at the given time.
     *
     * @param {JulianDate} time The time to update to.
     *
     * @exception {DeveloperError} time is required.
     */
    DynamicPolygonVisualizer.prototype.update = function(time) {
        if (!defined(time)) {
            throw new DeveloperError('time is requied.');
        }

        var createColorPrimitive = false;
        var addedObjects = this._addedObjects;
        var added = addedObjects.getObjects();
        var removedObjects = this._removedObjects;
        var removed = removedObjects.getObjects();

        var i;
        var dynamicObject;
        var instance;
        var color;
        var show;
        var dynamicPrimitive;

        for (i = removed.length - 1; i > -1; i--) {
            dynamicObject = removed[i];
            if (this._colorGeometries.remove(dynamicObject)) {
                createColorPrimitive = true;
            } else {
                dynamicPrimitive = this._dynamicPolygons[dynamicObject.id];
                if (defined(dynamicPrimitive)) {
                    this._dynamicPolygons[dynamicObject.id] = undefined;
                    this._unusedPolygons.push(dynamicPrimitive);
                    dynamicPrimitive.show = false;
                }
            }
        }

        for (i = added.length - 1; i > -1; i--) {
            dynamicObject = added[i];

            var vertexPositions = dynamicObject.vertexPositions;
            if (!defined(vertexPositions)) {
                continue;
            }

            var polygon = dynamicObject.polygon;
            if (!defined(polygon)) {
                continue;
            }

            var id = dynamicObject.id;
            var showProperty = polygon.show;
            show = dynamicObject.isAvailable(time) && (defined(showProperty) ? showProperty.getValue(time) : true);

            var positions = vertexPositions.getValue(time);
            var material = polygon.material;
            if (vertexPositions instanceof ConstantProperty && material instanceof ColorMaterialProperty) {
                var colorProperty = material.color;
                color = defined(colorProperty) ? colorProperty.getValue(time) : Color.WHITE;
                instance = new GeometryInstance({
                    id : id,
                    geometry : PolygonGeometry.fromPositions({
                        positions : positions,
                        vertexFormat : PerInstanceColorAppearance.VERTEX_FORMAT
                    }),
                    attributes : {
                        show : new ShowGeometryInstanceAttribute(show),
                        color : ColorGeometryInstanceAttribute.fromColor(color)
                    }
                });

                instance.dynamicColor = defined(colorProperty) && !(colorProperty instanceof ConstantProperty);
                instance.color = colorProperty;
                instance.dynamicShow = (defined(showProperty) && !(showProperty instanceof ConstantProperty)) || defined(dynamicObject.availability);
                instance.show = showProperty;
                instance.dynamicObject = dynamicObject;

                this._colorGeometries.add(instance);
                createColorPrimitive = true;
            } else if (show) {
                var polygonPrimitive = this._unusedPolygons.pop();
                if (!defined(polygonPrimitive)) {
                    polygonPrimitive = new Polygon();
                }
                polygonPrimitive.id = polygonPrimitive;
                this._dynamicPolygons[dynamicObject.id] = polygonPrimitive;
                this._dynamicPolygonsArray.push(polygonPrimitive);
            } else {
                dynamicPrimitive = this._dynamicPolygons[dynamicObject.id];
                if (defined(dynamicPrimitive)) {
                    this._dynamicPolygons[dynamicObject.id] = undefined;
                    this._unusedPolygons.push(dynamicPrimitive);
                    dynamicPrimitive.show = false;
                }
            }
        }

        addedObjects.removeAll();
        removedObjects.removeAll();

        var colorPrimitive = this._colorPrimitive;
        var primitives = this._primitives;
        if (createColorPrimitive) {
            if (defined(colorPrimitive)) {
                primitives.remove(colorPrimitive);
            }
            colorPrimitive = new Primitive({
                asynchronous : false,
                geometryInstances : this._colorGeometries.getArray(),
                appearance : new PerInstanceColorAppearance({
                    translucent : true
                })
            });

            primitives.add(colorPrimitive);
            this._colorPrimitive = colorPrimitive;
        } else {
            var geometries = this._colorGeometries.getArray();
            for (i = geometries.length - 1; i > -1; i--) {
                instance = geometries[i];
                var attributes = instance.dynamicAttributes;
                if (!defined(attributes)) {
                    attributes = colorPrimitive.getGeometryInstanceAttributes(instance.id);
                    instance.dynamicAttributes = attributes;
                }
                if (instance.dynamicColor) {
                    color = instance.color.getValue(time);
                    if (defined(color)) {
                        attributes.color = ColorGeometryInstanceAttribute.toValue(color, attributes.color);
                    }
                }
                if (instance.dynamicShow) {
                    show = instance.dynamicObject.isAvailable(time) && (!defined(instance.show) || instance.show.getValue(time));
                    if (defined(show)) {
                        attributes.show = ShowGeometryInstanceAttribute.toValue(show, attributes.show);
                    }
                }
            }
        }
    };

    /**
     * Removes all primitives from the scene.
     */
    DynamicPolygonVisualizer.prototype.removeAllPrimitives = function() {
        var primitives = this._primitives;
        this._addedObjects.removeAll();
        this._removedObjects.removeAll();
        if (defined(this._colorPrimitive)) {
            this._colorGeometries = new HashMap();
            primitives.remove(this._colorPrimitive);
        }
        this._unusedPolygons = [];
        this._dynamicPolygons = {};
    };

    /**
     * Returns true if this object was destroyed; otherwise, false.
     * <br /><br />
     * If this object was destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.
     *
     * @memberof DynamicPolygonVisualizer
     *
     * @returns {Boolean} True if this object was destroyed; otherwise, false.
     *
     * @see DynamicPolygonVisualizer#destroy
     */
    DynamicPolygonVisualizer.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the WebGL resources held by this object.  Destroying an object allows for deterministic
     * release of WebGL resources, instead of relying on the garbage collector to destroy this object.
     * <br /><br />
     * Once an object is destroyed, it should not be used; calling any function other than
     * <code>isDestroyed</code> will result in a {@link DeveloperError} exception.  Therefore,
     * assign the return value (<code>undefined</code>) to the object as done in the example.
     *
     * @memberof DynamicPolygonVisualizer
     *
     * @returns {undefined}
     *
     * @exception {DeveloperError} This object was destroyed, i.e., destroy() was called.
     *
     * @see DynamicPolygonVisualizer#isDestroyed
     *
     * @example
     * visualizer = visualizer && visualizer.destroy();
     */
    DynamicPolygonVisualizer.prototype.destroy = function() {
        this.removeAllPrimitives();
        return destroyObject(this);
    };

    DynamicPolygonVisualizer.prototype.onCollectionChanged = function(dynamicObjectCollection, added, removed) {
        var addedObjects = this._addedObjects;
        var removedObjects = this._removedObjects;

        var i;
        var dynamicObject;
        for (i = removed.length - 1; i > -1; i--) {
            dynamicObject = removed[i];
            addedObjects.remove(dynamicObject);
            removedObjects.add(dynamicObject);
        }

        for (i = added.length - 1; i > -1; i--) {
            dynamicObject = added[i];
            addedObjects.add(dynamicObject);
            removedObjects.remove(dynamicObject);
        }
    };

    return DynamicPolygonVisualizer;
});
