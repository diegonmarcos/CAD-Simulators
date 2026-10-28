# CAD-Simulators

CAD and simulators for the DeepSc family (renamed from DeepSc-Tools, public). CAD tools are pinned git submodules of their upstream; sailytics is in-repo code.

## Sailytics

`tools/sailytics`: in-repo code (not a submodule), moved with history from Projects-labtools `c-Stk_DsX/sailytics` (#1260). Own `build.json`/`build.sh`/`ship.yml`.

## CAD: agentic 3D modelling over MCP

| Tool | Upstream | Licence | Drives | Last commit at pin |
|---|---|---|---|---|
| freecad-mcp | [neka-nat/freecad-mcp](https://github.com/neka-nat/freecad-mcp) (~3.1k stars) | MIT | FreeCAD (parametric solid CAD), via an addon inside FreeCAD plus an MCP server | 2026-10-25 (v0.1.28) |
| blender-mcp | [ahujasid/blender-mcp](https://github.com/ahujasid/blender-mcp) | MIT | Blender (mesh modelling, scenes, materials), via a Blender addon socket plus an MCP server | 2026-10-28 |
| autocad-mcp | [puran-water/autocad-mcp](https://github.com/puran-water/autocad-mcp) | MIT | AutoCAD LT 2024+ on Windows (File IPC), or headless DXF on any OS via ezdxf (`AUTOCAD_MCP_BACKEND=auto\|file_ipc\|ezdxf`) | 2026-02-20 |

Update a pin: `git submodule update --remote tools/cad/<name>` then commit.

### MCP client config (example)

```json
{
  "mcpServers": {
    "freecad": { "command": "uvx", "args": ["freecad-mcp"] },
    "blender": { "command": "uvx", "args": ["blender-mcp"] },
    "autocad": {
      "command": "uv",
      "args": ["--directory", "tools/cad/autocad-mcp", "run", "python", "-m", "autocad_mcp"],
      "env": { "AUTOCAD_MCP_BACKEND": "ezdxf" }
    }
  }
}
```

FreeCAD and Blender need their addon installed and started inside the app first; see each upstream README. The AutoCAD server needs no AutoCAD on the `ezdxf` backend.
