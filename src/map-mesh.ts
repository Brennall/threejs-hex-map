import {TileData, isLand, isWater, isMountain, TextureAtlas, isHill} from "./interfaces"
import {createHexagon} from "./hexagon"
import {
    InstancedBufferGeometry,
    RawShaderMaterial,
    BufferGeometry,
    Vector2,
    Vector3,
    Vector4,
    Texture,
    Mesh,
    TextureLoader,
    XHRLoader,
    BufferAttribute
} from "three"
import {Promise} from "es6-promise"
import {loadFile, qrRange} from "./util"
import TileGrid from "./tile-grid";

const textureLoader = new TextureLoader()

export default class MapMesh extends THREE.Group {

    static landShaders = {
        fragmentShader: loadFile("../../src/shaders/land.fragment.glsl"),
        vertexShader: loadFile("../../src/shaders/land.vertex.glsl")
    }

    static waterShaders = {
        fragmentShader: loadFile("../../src/shaders/water.fragment.glsl"),
        vertexShader: loadFile("../../src/shaders/water.vertex.glsl")
    }

    static mountainShaders = {
        fragmentShader: loadFile("../../src/shaders/mountains.fragment.glsl"),
        vertexShader: loadFile("../../src/shaders/mountains.vertex.glsl")
    }

    private land: Mesh
    //private water: Mesh
    private mountains: Mesh

    constructor(private _tiles: TileData[], private _textureAtlas: TextureAtlas) {
        super()
        this.createLandMesh(_tiles.filter(t => !isMountain(t.height)))
        //this.createWaterMesh(_tiles.filter(t => isWater(t.height)))
        this.createMountainMesh(_tiles.filter(t => isMountain(t.height)))
    }

    createLandMesh(tiles: TileData[]) {
        const vertexShader = MapMesh.landShaders.vertexShader
        const fragmentShader = MapMesh.landShaders.fragmentShader
        const atlas = this._textureAtlas

        const hillNormal = textureLoader.load("textures/hills-normal.png")
        hillNormal.wrapS = hillNormal.wrapT = THREE.RepeatWrapping

        const coastAtlas = textureLoader.load("textures/coast-diffuse.png")
        const riverAtlas = textureLoader.load("textures/river-diffuse.png")

        Promise.all([vertexShader, fragmentShader]).then(([vertexShader, fragmentShader]) => {
            const geometry = createHexagonTilesGeometry(tiles, 0, this._textureAtlas)
            const material = new THREE.RawShaderMaterial({
                uniforms: {
                    sineTime: {value: 0.0},
                    camera: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                    texture: {type: "t", value: textureLoader.load(this._textureAtlas.image)},
                    textureAtlasMeta: {
                        type: "4f",
                        value: new Vector4(atlas.width, atlas.height, atlas.cellSize, atlas.cellSpacing)
                    },
                    hillsNormal: {
                        type: "t",
                        value: hillNormal
                    },
                    coastAtlas: {
                        type: "t",
                        value: coastAtlas
                    },
                    riverAtlas: {
                        type: "t",
                        value: riverAtlas
                    }
                },
                vertexShader: vertexShader,
                fragmentShader: fragmentShader,
                side: THREE.FrontSide,
                wireframe: false,
                transparent: false
            })

            this.land = new Mesh(geometry, material)
            this.add(this.land)
        })
    }

    createWaterMesh(tiles: TileData[]) {
    }

    createMountainMesh(tiles: TileData[]) {
        const vertexShader = MapMesh.mountainShaders.vertexShader
        const fragmentShader = MapMesh.mountainShaders.fragmentShader
        const atlas = this._textureAtlas

        const hillNormal = textureLoader.load("textures/hills-normal.png")
        hillNormal.wrapS = hillNormal.wrapT = THREE.RepeatWrapping

        Promise.all([vertexShader, fragmentShader]).then(([vertexShader, fragmentShader]) => {
            const geometry = createHexagonTilesGeometry(tiles, 1, this._textureAtlas)
            const material = new THREE.RawShaderMaterial({
                uniforms: {
                    sineTime: {value: 0.0},
                    camera: {type: "v3", value: new THREE.Vector3(0, 0, 0)},
                    texture: {type: "t", value: textureLoader.load(this._textureAtlas.image)},
                    textureAtlasMeta: {
                        type: "4f",
                        value: new Vector4(atlas.width, atlas.height, atlas.cellSize, atlas.cellSpacing)
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
            })

            this.mountains = new Mesh(geometry, material)
            this.add(this.mountains)
        })
    }
}

function createHexagonTilesGeometry(tiles: TileData[], numSubdivisions: number, textureAtlas: TextureAtlas) {
    const grid = new TileGrid(tiles)
    const hexagon = createHexagon(1.0, numSubdivisions)
    const geometry = new InstancedBufferGeometry()

    geometry.maxInstancedCount = tiles.length
    geometry.addAttribute("position", (hexagon.attributes as any).position)
    geometry.addAttribute("uv", (hexagon.attributes as any).uv)
    geometry.addAttribute("border", (hexagon.attributes as any).border)

    // positions for each hexagon tile
    var tilePositions = tiles.map((tile) => new Vector2(Math.sqrt(3) * (tile.q + tile.r / 2), 3 / 2 * tile.r))
    var posAttr = new THREE.InstancedBufferAttribute(new Float32Array(tilePositions.length * 3), 2, 1)
    posAttr.copyVector2sArray(tilePositions)
    geometry.addAttribute("offset", posAttr)

    //----------------
    const cellSize = textureAtlas.cellSize
    const cellSpacing = textureAtlas.cellSpacing
    const numColumns = textureAtlas.width / cellSize

    var styles = tiles.map(function (tile) {
        const cell = textureAtlas.textures[tile.terrain]

        const cellIndex = cell.cellY * numColumns + cell.cellX
        const shadow = tile.fog             ? 1 : 0
        //const clouds = tile.clouds          ? 1 << 1 : 0
        const hills = isHill(tile.height)   ? 1 : 0
        const style = shadow * 1 + hills * 10

        // Coast and River texture index
        const coastIdx = computeCoastTextureIndex(grid, tile)
        const riverIdx = computeRiverTextureIndex(grid, tile)

        return new Vector4(cellIndex, style, coastIdx, riverIdx)
    })

    var styleAttr = new THREE.InstancedBufferAttribute(new Float32Array(tilePositions.length * 4), 4, 1)
    styleAttr.copyVector4sArray(styles)
    geometry.addAttribute("style", styleAttr)

    return geometry
}

function computeCoastTextureIndex(grid: TileGrid, tile: TileData): number {
    function isWaterTile(q: number, r: number) {
        const t = grid.get(q, r)
        if (!t) return false
        return isWater(t.height)
    }

    function bit(x: boolean) {
        return x ? "1" : "0"
    }

    if (isWaterTile(tile.q, tile.r)) {
        // only land tiles have a coast
        return 0
    }

    const NE = bit(isWaterTile(tile.q + 1, tile.r - 1))
    const E = bit(isWaterTile(tile.q + 1, tile.r))
    const SE = bit(isWaterTile(tile.q, tile.r + 1))
    const SW = bit(isWaterTile(tile.q - 1, tile.r + 1))
    const W = bit(isWaterTile(tile.q - 1, tile.r))
    const NW = bit(isWaterTile(tile.q, tile.r - 1))

    return parseInt(NE + E + SE + SW + W + NW, 2)
}

function computeRiverTextureIndex(grid: TileGrid, tile: TileData): number {
    function isRiver(q: number, r: number) {
        const t = grid.get(q, r)
        if (!t) return false
        if (!t.river) return false

        return true
        //return Math.abs(t.river.riverTileIndex - tile.river.riverTileIndex) == 1
    }

    function bit(x: boolean) {
        return x ? "1" : "0"
    }

    const NE = bit(isRiver(tile.q + 1, tile.r - 1))
    const E = bit(isRiver(tile.q + 1, tile.r))
    const SE = bit(isRiver(tile.q, tile.r + 1))
    const SW = bit(isRiver(tile.q - 1, tile.r + 1))
    const W = bit(isRiver(tile.q - 1, tile.r))
    const NW = bit(isRiver(tile.q, tile.r - 1))

    return parseInt(NE + E + SE + SW + W + NW, 2)
}