<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep destructive image editing in browser-side canvas helpers so imported assets remain local and exports receive flattened transparent PNG data URLs.
- Keep background-video tracking and approximate viewpoint calculations in a shared browser-side helper so stage preview and recorded frames use identical offsets and visibility rules.
- Keep puppet deformation in shared Three.js bind-space skinning helpers and use the same textured mesh projection in the stage and video export to prevent divergent poses.
- Route mouse image transforms through the editor's property writer so existing animated tracks retain their keyframe behavior.
- Import native model skeletons with stable traversal identifiers and apply local bone poses through one shared writer for stage and video frames, preserving skin weights and inverse bind matrices.
