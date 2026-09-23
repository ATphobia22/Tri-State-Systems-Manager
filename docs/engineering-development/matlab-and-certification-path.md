# Engineering Development and MATLAB Resource Map

**Status:** reference guidance, not a licensure determination  
**Verified:** 2026-09-23

This document separates engineering licensure, professional certifications, software credentials, and safety training. A credential is never treated by TSM as evidence that a person is authorized to perform a regulated engineering service.

## MATLAB and scientific-computing resources

The `ATphobia22/awesome-matlab` collection is useful as a discovery index for MATLAB/Octave toolboxes, optimization, robotics, geospatial processing, machine learning, numerical methods, visualization, and scientific computing. Community-curated entries must be independently reviewed before they are adopted into a production dependency or engineering evidence chain.

Preferred first-party resources identified during review:

- MathWorks student resources: https://github.com/mathworks/awesome-matlab-students
- MathWorks open-source projects: https://mathworks.github.io/
- MathWorks certification: https://www.mathworks.com/learn/training/certification.html
- MATLAB MCP Core Server / Agentic Toolkit resources should be evaluated as developer tooling only; agent output does not replace deterministic testing, engineering review, or professional certification.
- For production numerical workflows, preserve units, coordinate reference systems, tolerances, input provenance, deterministic test vectors, and independent validation.

Useful capability areas represented by the reviewed MATLAB ecosystem include:

1. numerical linear algebra and scientific computing;
2. optimization and constrained optimization;
3. control, state estimation, and model predictive control;
4. robotics, trajectory planning, and spatial mathematics;
5. signal/image processing;
6. finite-element and multiphysics workflows;
7. geospatial and GNSS processing;
8. machine learning and deep learning;
9. visualization and publication-quality reporting;
10. MATLAB/Octave interoperability and Python integration.

## Credential classification

| Credential / training | What it actually establishes | Engineering-development use |
|---|---|---|
| NCEES FE | Examination in engineering fundamentals; generally an early step toward PE licensure | High-value licensure pathway knowledge; keep distinct from PE licensure |
| Indiana Engineer Intern (EI) | State registration/certification pathway after meeting Indiana requirements | Useful state-specific licensure milestone |
| ASQ Six Sigma Green Belt | Six Sigma body-of-knowledge examination plus ASQ experience requirement | Process improvement / quality methods; not a substitute for engineering licensure |
| PMI PMP | Project-management certification with substantial professional-experience requirements | Project delivery and governance; generally a later-career credential |
| MathWorks Certified MATLAB Associate | Demonstrated MATLAB proficiency | Directly relevant to computational engineering and numerical analysis |
| MathWorks Certified Simulink Associate | Demonstrated Simulink proficiency | Relevant to model-based design and simulation |
| SOLIDWORKS CSWP | Professional CAD proficiency | Relevant to mechanical/design workflows; not a design authorization |
| LEED AP | Green-building/LEED credential | Relevant to sustainable building and infrastructure work |
| OSHA Outreach 10/30-hour | Hazard-awareness training and course-completion card | Useful safety training; **not** an OSHA certification or license |

## Important eligibility corrections

### FE / PE pathway

NCEES describes the FE as generally the first step toward becoming a licensed professional engineer and targets recent graduates and students near completion of an undergraduate engineering degree. State licensing requirements remain controlling.

For Indiana specifically, the Indiana Professional Licensing Agency states that FE candidates register directly with NCEES; after passing, an applicant can apply to the Indiana Board for Engineer Intern certification. Indiana's PE process has separate education, examination, experience, references, and state-law requirements.

### Six Sigma

Do not describe ASQ's Certified Six Sigma Green Belt as a student-only credential. ASQ currently requires three years of full-time paid work experience in one or more areas of its CSSGB Body of Knowledge and does not grant an education waiver.

### PMP

Do not describe PMP as an entry-level student certification. PMI's current requirements include professional project-management experience plus 35 hours of project-management training, with the experience requirement depending on educational background.

### MATLAB

MathWorks currently offers Certified MATLAB Associate, Certified Simulink Associate, and Certified MATLAB Professional credentials. The Professional credential requires the Associate credential first. The Associate-level MATLAB credential is therefore a directly relevant software credential for a student or early-career computational-engineering portfolio.

### SOLIDWORKS

SOLIDWORKS offers associate and professional certifications. The standard CSWP has no prerequisite, while the academic CSWP path is intended for students with substantial SOLIDWORKS experience. Certification demonstrates software proficiency; it does not confer engineering licensure.

### LEED

LEED AP with specialty requires a current LEED Green Associate credential or taking/passing the Green Associate examination concurrently, and requires the candidate to be at least 18. LEED AP is a building-sustainability credential, not a professional-engineer license.

### OSHA

OSHA explicitly states that Outreach 10-hour and 30-hour cards are **not certifications or licenses** and do not by themselves satisfy OSHA standards' employer training requirements. Treat them as safety-awareness training records.

## TSM engineering-system rule

The repository should treat credentials as **human capability metadata**, never as technical evidence:

```text
credential -> person/capability record
survey / observation / dataset -> engineering evidence
model result -> derived evidence
agency determination / licensed professional certification -> governing decision
```

A credential must never automatically:

- certify a survey;
- certify an elevation;
- establish a FEMA determination;
- establish legal title;
- authorize an engineering seal;
- promote a secondary GIS source to authoritative status;
- bypass a human engineering-review gate.

## Primary sources

- NCEES FE: https://ncees.org/exams/fe-exam
- Indiana PLA Engineering Licensing: https://www.in.gov/pla/professions/engineering-home/engineering-licensing-information
- ASQ Six Sigma Green Belt: https://www.asq.org/cert/six-sigma-green-belt
- PMI PMP: https://www.pmi.org/certifications/project-management-pmp
- MathWorks Certification: https://www.mathworks.com/learn/training/certification.html
- SOLIDWORKS CSWP: https://www.solidworks.com/certifications/solidworks-design-professional
- USGBC LEED AP: https://www.usgbc.org/credentials/leed-ap
- OSHA Outreach FAQ: https://www.osha.gov/training/outreach/faq
