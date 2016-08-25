var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
define(["require", "exports", "./interfaces", "./hexagon", "three", "es6-promise", "./util"], function (require, exports, interfaces_1, hexagon_1, three_1, es6_promise_1, util_1) {
    "use strict";
    var textureLoader = new three_1.TextureLoader();
    var MapMesh = (function (_super) {
        __extends(MapMesh, _super);
        function MapMesh(_tiles, _textureAtlas) {
            _super.call(this);
            this._tiles = _tiles;
            this._textureAtlas = _textureAtlas;
            this.createLandMesh(_tiles.filter(function (t) { return !interfaces_1.isMountain(t.height); }));
            //this.createWaterMesh(_tiles.filter(t => isWater(t.height)))
            this.createMountainMesh(_tiles.filter(function (t) { return interfaces_1.isMountain(t.height); }));
            var mountains = _tiles.filter(function (t) { return interfaces_1.isMountain(t.height); });
            console.log("MOUNTAINS= ", mountains);
        }
        MapMesh.prototype.createLandMesh = function (tiles) {
            var _this = this;
            var vertexShader = MapMesh.landShaders.vertexShader;
            var fragmentShader = MapMesh.landShaders.fragmentShader;
            var atlas = this._textureAtlas;
            var hillNormal = textureLoader.load("textures/hills-normal.png");
            hillNormal.wrapS = hillNormal.wrapT = THREE.RepeatWrapping;
            es6_promise_1.Promise.all([vertexShader, fragmentShader]).then(function (_a) {
                var vertexShader = _a[0], fragmentShader = _a[1];
                var geometry = createHexagonTilesGeometry(tiles, 0, _this._textureAtlas);
                var material = new THREE.RawShaderMaterial({
                    uniforms: {
                        sineTime: { value: 0.0 },
                        camera: { type: "v3", value: new THREE.Vector3(0, 0, 0) },
                        texture: { type: "t", value: textureLoader.load(_this._textureAtlas.image) },
                        textureAtlasMeta: {
                            type: "4f",
                            value: new three_1.Vector4(atlas.width, atlas.height, atlas.cellSize, atlas.cellSpacing)
                        },
                        hillsNormal: {
                            type: "t",
                            value: hillNormal
                        }
                    },
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    side: THREE.FrontSide,
                    wireframe: false,
                    transparent: false
                });
                _this.land = new three_1.Mesh(geometry, material);
                _this.add(_this.land);
            });
        };
        MapMesh.prototype.createWaterMesh = function (tiles) {
        };
        MapMesh.prototype.createMountainMesh = function (tiles) {
            var _this = this;
            var vertexShader = MapMesh.mountainShaders.vertexShader;
            var fragmentShader = MapMesh.mountainShaders.fragmentShader;
            var atlas = this._textureAtlas;
            var hillNormal = textureLoader.load("textures/hills-normal.png");
            hillNormal.wrapS = hillNormal.wrapT = THREE.RepeatWrapping;
            es6_promise_1.Promise.all([vertexShader, fragmentShader]).then(function (_a) {
                var vertexShader = _a[0], fragmentShader = _a[1];
                var geometry = createHexagonTilesGeometry(tiles, 1, _this._textureAtlas);
                var material = new THREE.RawShaderMaterial({
                    uniforms: {
                        sineTime: { value: 0.0 },
                        camera: { type: "v3", value: new THREE.Vector3(0, 0, 0) },
                        texture: { type: "t", value: textureLoader.load(_this._textureAtlas.image) },
                        textureAtlasMeta: {
                            type: "4f",
                            value: new three_1.Vector4(atlas.width, atlas.height, atlas.cellSize, atlas.cellSpacing)
                        },
                        hillsNormal: {
                            type: "t",
                            value: hillNormal
                        }
                    },
                    vertexShader: vertexShader,
                    fragmentShader: fragmentShader,
                    side: THREE.FrontSide,
                    wireframe: false,
                    transparent: false
                });
                _this.mountains = new three_1.Mesh(geometry, material);
                _this.add(_this.mountains);
            });
        };
        MapMesh.landShaders = {
            fragmentShader: util_1.loadFile("../../src/shaders/land.fragment.glsl"),
            vertexShader: util_1.loadFile("../../src/shaders/land.vertex.glsl")
        };
        MapMesh.waterShaders = {
            fragmentShader: util_1.loadFile("../../src/shaders/water.fragment.glsl"),
            vertexShader: util_1.loadFile("../../src/shaders/water.vertex.glsl")
        };
        MapMesh.mountainShaders = {
            fragmentShader: util_1.loadFile("../../src/shaders/mountains.fragment.glsl"),
            vertexShader: util_1.loadFile("../../src/shaders/mountains.vertex.glsl")
        };
        return MapMesh;
    }(THREE.Group));
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = MapMesh;
    function createHexagonTilesGeometry(tiles, numSubdivisions, textureAtlas) {
        var hexagon = hexagon_1.createHexagon(1.0, numSubdivisions);
        var geometry = new three_1.InstancedBufferGeometry();
        geometry.maxInstancedCount = tiles.length;
        geometry.addAttribute("position", hexagon.attributes.position);
        geometry.addAttribute("uv", hexagon.attributes.uv);
        geometry.addAttribute("border", hexagon.attributes.border);
        // positions for each hexagon tile
        var tilePositions = tiles.map(function (tile) { return new three_1.Vector2(Math.sqrt(3) * (tile.q + tile.r / 2), 3 / 2 * tile.r); });
        var posAttr = new THREE.InstancedBufferAttribute(new Float32Array(tilePositions.length * 3), 2, 1);
        posAttr.copyVector2sArray(tilePositions);
        geometry.addAttribute("offset", posAttr);
        //----------------
        var cellSize = textureAtlas.cellSize;
        var cellSpacing = textureAtlas.cellSpacing;
        var numColumns = textureAtlas.width / cellSize;
        var styles = tiles.map(function (tile) {
            var cell = textureAtlas.textures[tile.terrain];
            var cellIndex = cell.cellY * numColumns + cell.cellX;
            var shadow = tile.fog ? 1 : 0;
            //const clouds = tile.clouds          ? 1 << 1 : 0
            var hills = interfaces_1.isHill(tile.height) ? 1 : 0;
            var style = shadow * 1 + hills * 10;
            return new three_1.Vector2(cellIndex, style);
        });
        var styleAttr = new THREE.InstancedBufferAttribute(new Float32Array(tilePositions.length * 3), 2, 1);
        styleAttr.copyVector2sArray(styles);
        geometry.addAttribute("style", styleAttr);
        return geometry;
    }
});
