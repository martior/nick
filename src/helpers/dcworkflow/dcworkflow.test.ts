/**
 * DCWorkflow helper tests.
 * @module helpers/dcworkflow/dcworkflow.test
 */

// External imports
import { readdirSync, readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

// Internal imports
import {
  convertDefinition,
  convertWorkflow,
  parseWorkflowBindings,
  parseXml,
} from './dcworkflow';

const xml = `<?xml version="1.0"?>
<dc-workflow workflow_id="intranet" title="Intranet" description=" - Only for - members." initial_state="internal" manager_bypass="True">
 <permission>View</permission>
 <permission>Modify portal content</permission>
 <permission>Access contents information</permission>
 <state state_id="internal" title="Internal draft">
  <description>Draft</description>
  <exit-transition transition_id="publish"/>
  <exit-transition transition_id="touch"/>
  <permission-map name="View" acquired="False">
   <permission-role>Manager</permission-role>
   <permission-role>Member</permission-role>
   <permission-role>Owner</permission-role>
  </permission-map>
  <permission-map name="Access contents information" acquired="False">
   <permission-role>Member</permission-role>
  </permission-map>
  <permission-map name="Modify portal content" acquired="False">
   <permission-role>Site Administrator</permission-role>
   <permission-role>Owner</permission-role>
  </permission-map>
 </state>
 <state state_id="external" title="Externally visible">
  <exit-transition transition_id="retract"/>
  <permission-map name="View" acquired="True">
   <permission-role>Anonymous</permission-role>
  </permission-map>
  <group-map name="staff"><group-role>Editor</group-role></group-map>
 </state>
 <transition transition_id="publish" title="Reviewer publishes" new_state="external" trigger="USER" after_script="notify">
  <action url="" category="workflow" icon="">Publish externally</action>
  <guard>
   <guard-permission>Review portal content</guard-permission>
   <guard-permission>Access contents information</guard-permission>
   <guard-role>Manager</guard-role>
   <guard-role>Owner</guard-role>
   <guard-group>staff</guard-group>
   <guard-expression>python:user.has_role('Owner', here)</guard-expression>
  </guard>
 </transition>
 <transition transition_id="retract" title="Retract" new_state="internal" trigger="USER">
  <guard><guard-expression>python:here.may_retract()</guard-expression></guard>
 </transition>
 <transition transition_id="touch" title="Touch" new_state="" trigger="USER">
  <action category="workflow">Touch</action>
 </transition>
 <transition transition_id="auto" title="Auto" new_state="external" trigger="AUTOMATIC">
  <guard><guard-permission>Access contents information</guard-permission></guard>
 </transition>
</dc-workflow>`;

describe('DCWorkflow', () => {
  describe('parseXml', () => {
    it('parses elements, attributes and text', () => {
      const root = parseXml(
        '<?xml version="1.0"?><a x="1 &amp; 2"><!-- c --><b>T &lt;b&gt;</b><c/></a>',
      );
      expect(root.name).toBe('a');
      expect(root.attributes.x).toBe('1 & 2');
      expect(root.children.map((child) => child.name)).toEqual(['b', 'c']);
      expect(root.children[0].text).toBe('T <b>');
    });
  });

  describe('convertDefinition', () => {
    it('converts the workflow and its states', () => {
      const { workflow } = convertDefinition(xml);
      expect(workflow.id).toBe('intranet');
      expect(workflow.description).toBe('Only for members.');
      expect(workflow.json.initial_state).toBe('internal');
      expect(workflow.json.manager_bypass).toBe(true);
      expect(workflow.json.managed_permissions).toEqual(['View', 'Modify']);
      expect(workflow.json.states.internal).toEqual({
        title: 'Internal draft',
        description: 'Draft',
        transitions: ['publish', 'touch'],
        permissions: {
          Administrator: ['View', 'Modify'],
          Authenticated: ['View'],
          Owner: ['View', 'Modify'],
        },
      });

      // Acquired permission maps and managed permissions without a map
      // are acquired
      expect(workflow.json.states.external).toEqual({
        title: 'Externally visible',
        description: '',
        transitions: ['retract'],
        permissions: { Anonymous: ['View'], Authenticated: ['View'] },
        acquire: ['View', 'Modify'],
      });
    });

    it('converts the transitions with their guards', () => {
      const { workflow } = convertDefinition(xml);
      expect(workflow.json.transitions.publish).toEqual({
        title: 'Publish externally',
        description: '',
        new_state: 'external',
        guard: {
          permissions: ['Review'],
          roles: ['Administrator', 'Owner'],
          groups: ['staff'],
          expr: "python:user.has_role('Owner', here)",
        },
      });

      // Unsupported expressions are kept and marked, transitions without
      // an action are hidden
      expect(workflow.json.transitions.retract).toEqual({
        title: 'Retract',
        description: '',
        new_state: 'internal',
        guard: {
          expr: 'python:here.may_retract()',
          unsupported:
            'Method "may_retract" of the content object is not registered.',
        },
        hidden: true,
      });

      // An empty new state stays, automatic transitions are kept
      expect(workflow.json.transitions.touch).toEqual({
        title: 'Touch',
        description: '',
        new_state: '',
      });
      expect(workflow.json.transitions.auto).toEqual({
        title: 'Auto',
        description: '',
        new_state: 'external',
        guard: { permissions: ['Manage Site'] },
        trigger: 'automatic',
      });
    });

    it('lists what is not converted', () => {
      const { warnings } = convertDefinition(xml, 'custom');
      expect(warnings).toEqual([
        'custom: permissions without a Nick equivalent are not managed: Access contents information',
        'custom, state external: group maps (local roles of groups by state) are not converted',
        'custom, transition publish: guard permissions without a Nick equivalent dropped: Access contents information',
        'custom, transition publish: the after script notify is not converted',
        'custom, transition retract: unsupported guard expression "python:here.may_retract()" (Method "may_retract" of the content object is not registered.), it denies',
        'custom, transition auto: guard permissions without a Nick equivalent dropped: Access contents information (Manage Site required instead)',
      ]);
      expect(convertWorkflow(xml, 'custom').id).toBe('custom');
    });

    it('converts the standard Plone workflows without unsupported parts', () => {
      const path = `${import.meta.dirname}/fixtures/workflows`;
      readdirSync(path).map((id) => {
        const { workflow, warnings } = convertDefinition(
          readFileSync(`${path}/${id}/definition.xml`, 'utf8'),
          id,
        );
        expect(workflow.id).toBe(id);
        expect(
          warnings.filter(
            (warning) => !warning.includes('Access contents information'),
          ),
        ).toEqual([]);
      });
    });

    it('refuses other xml', () => {
      expect(() => convertDefinition('<object name="x"/>')).toThrow(
        /Not a DCWorkflow definition/,
      );
    });
  });

  describe('parseWorkflowBindings', () => {
    it('reads the default chain and the chains by type', () => {
      expect(
        parseWorkflowBindings(`<object name="portal_workflow">
 <bindings>
  <default><bound-workflow workflow_id="simple_publication_workflow"/></default>
  <type type_id="Event"><bound-workflow workflow_id="intranet_workflow"/></type>
  <type type_id="File"/>
 </bindings>
</object>`),
      ).toEqual({
        default: ['simple_publication_workflow'],
        types: { Event: ['intranet_workflow'], File: [] },
      });
    });
  });
});
