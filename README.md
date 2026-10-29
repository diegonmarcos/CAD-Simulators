# CAD-Simulators

CAD and simulators for the DeepSc family (renamed from DeepSc-Tools, public). CAD tools are pinned git submodules of their upstream; sailytics is in-repo code (#1279 layout).

## Structure

```
CAD-Simulators/
  Structural-Designer/
    OpenCAD/      freecad-mcp, autocad-mcp (submodules)
    OpenRevit/    README, rvt-mcp (submodule, Revit MCP, Apache-2.0)
    OpenBIM/      README, bonsai-mcp (submodule, IFC/Bonsai MCP, MIT)
  Simulators/
    blender-mcp/  (submodule)
    sailytics/    (in-repo code)
  0_hub/DeepSc-___
```

## Sailytics

`Simulators/sailytics`: in-repo code (not a submodule), moved with history from Projects-labtools `c-Stk_DsX/sailytics` (#1260). Own `build.json`/`build.sh`/`ship.yml`.

## CAD: agentic 3D modelling over MCP

| Tool | Upstream | Licence | Drives | Last commit at pin |
|---|---|---|---|---|
| freecad-mcp (`Structural-Designer/OpenCAD`) | [neka-nat/freecad-mcp](https://github.com/neka-nat/freecad-mcp) (~3.1k stars) | MIT | FreeCAD (parametric solid CAD), via an addon inside FreeCAD plus an MCP server | 2026-10-25 (v0.1.28) |
| blender-mcp (`Simulators`) | [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) | MIT | Blender (mesh modelling, scenes, materials), via a Blender addon socket plus an MCP server | 2026-10-28 |
| autocad-mcp (`Structural-Designer/OpenCAD`) | [puran-water/autocad-mcp](https://github.com/puran-water/autocad-mcp) | MIT | AutoCAD LT 2024+ on Windows (File IPC), or headless DXF on any OS via ezdxf (`AUTOCAD_MCP_BACKEND=auto\|file_ipc\|ezdxf`) | 2026-02-20 |
| rvt-mcp (`Structural-Designer/OpenRevit`) | [bimwright/rvt-mcp](https://github.com/bimwright/rvt-mcp) (~100 stars) | Apache-2.0 | Autodesk Revit 2022–2027 on Windows (BIM authoring) | 2026-10-23 |
| bonsai-mcp (`Structural-Designer/OpenBIM`) | [JotaDeRodriguez/Bonsai_mcp](https://github.com/JotaDeRodriguez/Bonsai_mcp) (~66 stars) | MIT | Bonsai (BlenderBIM) + IfcOpenShell in Blender: IFC models | 2026-09-06 |

Update a pin: `git submodule update --remote <path>` then commit.

### MCP client config (example)

```json
{
  "mcpServers": {
    "freecad": { "command": "uvx", "args": ["freecad-mcp"] },
    "blender": { "command": "uvx", "args": ["blender-mcp"] },
    "autocad": {
      "command": "uv",
      "args": ["--directory", "Structural-Designer/OpenCAD/autocad-mcp", "run", "python", "-m", "autocad_mcp"],
      "env": { "AUTOCAD_MCP_BACKEND": "ezdxf" }
    }
  }
}
```

FreeCAD and Blender need their addon installed and started inside the app first; see each upstream README. The AutoCAD server needs no AutoCAD on the `ezdxf` backend.
