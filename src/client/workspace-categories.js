/** Functional submenus are populated from the CURRENT screen's real task sections.
 * Cross-screen navigation is available from Home and the five-slot dock only.
 */
export function renderWorkspaceCategories(_screens,activeKey){
 if(activeKey==='overview')return '';
 return '<nav class="os-category-nav os-context-orbs os-functional-nav" '+
   'data-os-functional-menu aria-label="หัวข้องานย่อยของหน้านี้"></nav>';
}
