/**
 * Hardcoded educational blurbs for the Sample Detail Page.
 * Keys match mock data: organism id, sample type, disease, study purpose.
 */

// Organism id (NCBI-[taxonomyId]) -> { description, taxonomy }
export const ORGANISM_CONTENT = {
  'NCBI-9606': {
    description:
      'Homo sapiens (human) is the most studied organism in biomedical research. The Human Genome Project completed in 2003 provided a reference sequence that continues to drive disease genetics, drug development, and personalized medicine. Human samples are essential for understanding genetic variants linked to disease susceptibility, pharmacogenomics, and biomarker discovery. Research on human specimens must follow strict ethical and regulatory guidelines.',
    taxonomy: 'Kingdom: Animalia · Phylum: Chordata · Class: Mammalia · Order: Primates · Family: Hominidae · Genus: Homo · Species: Homo sapiens',
  },
  'NCBI-10090': {
    description:
      'Mus musculus (house mouse) is the most widely used mammalian model organism in biomedical research. Mice share approximately 85% of their genome with humans and have been instrumental in preclinical drug testing, genetic studies, and understanding disease mechanisms. Their short generation time, ease of breeding, and the availability of genetically modified strains make them indispensable for studying cancer, immunology, neuroscience, and metabolic disorders.',
    taxonomy: 'Kingdom: Animalia · Phylum: Chordata · Class: Mammalia · Order: Rodentia · Family: Muridae · Genus: Mus · Species: Mus musculus',
  },
  'NCBI-3702': {
    description:
      'Arabidopsis thaliana (thale cress) is the primary model organism for plant biology. It has a small genome, a short life cycle of about six weeks, and is easy to grow in the lab. Research on Arabidopsis has advanced our understanding of plant genetics, molecular biology, development, and responses to stress. Findings in Arabidopsis often translate to crops, supporting agricultural improvement and food security.',
    taxonomy: 'Kingdom: Plantae · Phylum: Angiosperms · Class: Eudicots · Order: Brassicales · Family: Brassicaceae · Genus: Arabidopsis · Species: Arabidopsis thaliana',
  },
  'NCBI-562': {
    description:
      'Escherichia coli is one of the most well-studied prokaryotes and a workhorse of molecular biology and genetic engineering. It is used for cloning, protein expression, and fundamental studies of gene regulation and metabolism. E. coli is also central to antibiotic resistance research, as many resistance genes and mechanisms were first characterized in this bacterium. Understanding E. coli helps inform clinical treatment of infections and public health surveillance.',
    taxonomy: 'Kingdom: Bacteria · Phylum: Proteobacteria · Class: Gammaproteobacteria · Order: Enterobacterales · Family: Enterobacteriaceae · Genus: Escherichia · Species: Escherichia coli',
  },
  'NCBI-4932': {
    description:
      'Saccharomyces cerevisiae (baker\'s yeast) is the primary model for eukaryotic cell biology. It has been used to study cell division, gene expression, DNA repair, and metabolic pathways. Yeast is central to fermentation science and industrial biotechnology. Its compact genome and ease of genetic manipulation make it ideal for understanding conserved cellular mechanisms that apply to higher eukaryotes, including humans.',
    taxonomy: 'Kingdom: Fungi · Phylum: Ascomycota · Class: Saccharomycetes · Order: Saccharomycetales · Family: Saccharomycetaceae · Genus: Saccharomyces · Species: Saccharomyces cerevisiae',
  },
  'NCBI-7227': {
    description:
      'Drosophila melanogaster (fruit fly) has been a foundational model organism in genetics since the early 1900s. It was used to establish the chromosome theory of inheritance and to discover many genes that control development. Today it is used to study inheritance, development, neurobiology, aging, and behavior. Its short life cycle, low cost, and powerful genetic tools make it a mainstay of biological research.',
    taxonomy: 'Kingdom: Animalia · Phylum: Arthropoda · Class: Insecta · Order: Diptera · Family: Drosophilidae · Genus: Drosophila · Species: Drosophila melanogaster',
  },
  'NCBI-4530': {
    description:
      'Oryza sativa (rice) is one of the most important food crops globally and a staple for billions of people. It is a key species in agricultural genomics, with a sequenced genome that supports research into disease resistance, yield improvement, and stress tolerance. Studying rice at the molecular level helps develop better varieties for sustainable agriculture and food security, especially in Asia and other rice-growing regions.',
    taxonomy: 'Kingdom: Plantae · Phylum: Angiosperms · Class: Monocots · Order: Poales · Family: Poaceae · Genus: Oryza · Species: Oryza sativa',
  },
  'NCBI-7955': {
    description:
      'Danio rerio (zebrafish) is a powerful vertebrate model for developmental biology and biomedical research. Its embryos are transparent, allowing live imaging of cell division, migration, and organ formation. Zebrafish are used in genetic screening, drug discovery, and studying heart development, neurobiology, and regeneration. They combine the relevance of a vertebrate with the convenience of small, fast-growing, and genetically tractable organisms.',
    taxonomy: 'Kingdom: Animalia · Phylum: Chordata · Class: Actinopterygii · Order: Cypriniformes · Family: Cyprinidae · Genus: Danio · Species: Danio rerio',
  },
};

// Sample type -> blurb
export const SAMPLE_TYPE_CONTENT = {
  DNA: 'DNA (deoxyribonucleic acid) carries the genetic instructions for all known organisms. DNA is typically extracted from biological specimens using lysis, protease treatment, and purification steps. Extracted DNA is used in genomic sequencing, genotyping, mutation analysis, paternity testing, and forensic studies. High-quality DNA is essential for reliable downstream applications such as PCR and next-generation sequencing.',
  RNA: 'RNA (ribonucleic acid) plays roles in coding, decoding, and regulation of gene expression. RNA is isolated from cells or tissues using methods that minimize degradation, often involving RNase inhibitors and rapid processing. RNA is used in gene expression studies, transcriptomics, RT-PCR, and RNA-seq. Because RNA is less stable than DNA, proper handling and storage are critical for reproducible results.',
  Protein: 'Proteins are large biomolecules that perform most cellular functions, including catalysis and signaling. They are extracted and purified using techniques such as centrifugation, chromatography, and electrophoresis. Protein samples support proteomics, enzyme characterization, structural biology, and biomarker discovery. The choice of extraction method depends on the protein type and intended application.',
  Tissue: 'Tissue samples are collections of cells that form a functional unit within an organism. They are collected during biopsy or dissection and preserved by fixation (e.g., formalin) or cryopreservation. Tissue samples are used in histology, pathology, immunohistochemistry, and molecular analysis. Proper preservation is essential to maintain morphology and molecular integrity for research and diagnostics.',
  Blood: 'Blood samples contain plasma, serum, red blood cells, white blood cells, and platelets, each useful for different assays. Blood is collected by venipuncture or fingerstick and often processed to separate components. Blood is used in clinical diagnostics, immunology, biomarker studies, and genetic testing. Standardized collection and handling protocols ensure consistency across studies and clinical use.',
  'Cell Culture': 'Cell cultures are populations of cells grown in vitro under controlled conditions. Cells are maintained in culture media and can be passaged for many generations. Cell cultures are used in drug screening, toxicology, and studying cellular mechanisms without the complexity of whole organisms. They provide a reproducible system for hypothesis testing and high-throughput assays.',
  'Whole Organism': 'Whole organism specimens are intact individuals (or life stages such as larvae) preserved for study. They are collected in the field or lab and preserved by fixation, freezing, or other methods. Whole organisms are used in ecological studies, developmental biology, comparative anatomy, and taxonomy. They provide context for understanding biology at the level of the whole animal or plant.',
};

// Disease (or "N/A") -> blurb
export const DISEASE_CONTENT = {
  Hypertension:
    'Hypertension (high blood pressure) is a major global health concern and a leading risk factor for cardiovascular disease, stroke, and kidney failure. Genomic and molecular studies of hypertension aim to identify genetic variants and pathways that influence blood pressure regulation and treatment response. Such research supports the development of personalized prevention and treatment strategies.',
  Dengue:
    'Dengue fever is a mosquito-borne viral infection caused by the dengue virus, with significant impact in tropical and subtropical regions including the Philippines. Molecular studies of dengue focus on viral genetics, host immune response, and vaccine development. Understanding viral diversity and host-pathogen interactions is critical for effective surveillance and control.',
  Diabetes:
    'Diabetes is a metabolic disorder characterized by elevated blood glucose, with Type 1 (autoimmune) and Type 2 (often lifestyle-related) being the most common forms. It affects hundreds of millions of people worldwide. Genetic and molecular research is critical for understanding susceptibility, complications, and treatment response, and for developing new therapeutics and precision medicine approaches.',
  Tuberculosis:
    'Tuberculosis (TB) is a leading infectious disease caused by Mycobacterium tuberculosis, spread through the air. It remains a major cause of morbidity and mortality globally. Studying pathogen biology and resistance at the molecular level is essential for developing new drugs, diagnostics, and understanding how resistance emerges and spreads in populations.',
  Malaria:
    'Malaria is a life-threatening disease caused by Plasmodium parasites and transmitted by Anopheles mosquitoes. It has a heavy burden in tropical countries. Genomic research on Plasmodium and the human host supports drug resistance monitoring, vaccine development, and understanding parasite diversity and transmission dynamics.',
  Influenza:
    'Influenza is a contagious respiratory illness caused by influenza viruses, with seasonal outbreaks and potential for pandemics. Antigenic drift and shift allow the virus to evade immunity. Genomic surveillance of influenza strains is important for vaccine strain selection, outbreak tracking, and preparedness for novel variants.',
  'COVID-19':
    'COVID-19 is the disease caused by the coronavirus SARS-CoV-2, which led to a global pandemic. Genomic sequencing has been central to tracking variants, informing public health measures, and guiding vaccine and therapeutic development. Ongoing surveillance remains important for detecting new variants and understanding viral evolution.',
  'N/A':
    'This sample is not associated with a specific disease study. It may be used for general biological research, baseline characterization, or fundamental science investigations.',
};

// Study purpose (exact string from sample) -> blurb
export const STUDY_PURPOSE_CONTENT = {
  'Variant discovery':
    'Genetic variant discovery involves comparing DNA or RNA sequences to a reference to identify mutations such as single nucleotide polymorphisms (SNPs) and insertions or deletions (indels). This process is fundamental for understanding disease mechanisms, population genetics, and identifying therapeutic targets. Large-scale sequencing projects have made variant discovery a cornerstone of precision medicine.',
  'Expression profiling':
    'Gene expression profiling measures which genes are active in a sample and at what levels. Techniques such as RNA-seq and microarrays allow researchers to compare expression across conditions, tissues, or time points. Expression profiling is used in disease research, developmental biology, and drug discovery to identify key regulatory genes and pathways.',
  'Resistance gene mapping':
    'Resistance gene mapping identifies genes responsible for resistance to diseases (in crops) or to drugs (in pathogens or tumors). Researchers use genetic crosses, genome-wide association studies, or functional screens to locate these genes. The results support breeding for crop improvement and understanding mechanisms of drug resistance in clinical and agricultural settings.',
  'Resistance pattern mapping':
    'Antibiotic resistance pattern mapping determines which antibiotics a pathogen is resistant to, often using phenotypic assays or molecular detection of resistance genes. This information is crucial for guiding treatment choices and for public health surveillance of resistant infections. It supports stewardship programs and the development of new therapeutics.',
  'Neural development':
    'Neural development research focuses on how the nervous system forms during embryonic growth, including the birth, migration, and differentiation of neurons. Scientists use model organisms and imaging to study these processes. Understanding neural development is relevant to neurological disorders, birth defects, and regenerative medicine.',
  'Enzyme characterization':
    'Enzyme characterization involves studying the structure, function, kinetics, and regulation of enzymes. Researchers use biochemical and structural methods to understand how enzymes catalyze reactions and how they can be modulated. This work has applications in biotechnology, drug design, and industrial biocatalysis.',
  'Biomarker validation':
    'Biomarker validation tests whether candidate biomarkers reliably indicate a disease state, prognosis, or response to treatment. Validation involves assessing sensitivity, specificity, and reproducibility in relevant populations. Validated biomarkers are essential for clinical diagnostics, monitoring, and personalized medicine.',
  Transcriptomics:
    'Transcriptomics is the comprehensive study of all RNA transcripts in a cell or tissue at a given time. It reveals which genes are expressed and how their levels change under different conditions. Transcriptomics supports research in gene regulation, development, disease mechanisms, and biomarker discovery.',
  'Genome sequencing':
    'Genome sequencing determines the complete or nearly complete DNA sequence of an organism. It has become a foundational tool in research, medicine, and evolutionary biology. Genome sequences enable variant discovery, comparative genomics, and the identification of genes and regulatory elements.',
  'Developmental genetics':
    'Developmental genetics studies how genes control the growth and differentiation of organisms from fertilized egg to adult. It combines genetics with embryology and cell biology. This field is significant for understanding birth defects, evolution, and regenerative capacity.',
  'Model validation':
    'Model validation in biological research ensures that animal or cell models accurately represent the human disease or process of interest. Researchers compare molecular, physiological, and phenotypic features between the model and human. Validation is essential before translating findings to clinical applications.',
  'Host-pathogen interaction':
    'Host-pathogen interaction research examines the molecular and cellular interactions between a host organism and an infectious agent. Scientists study how pathogens invade, evade immunity, and cause disease, and how hosts respond. This work is relevant to developing treatments, vaccines, and diagnostic tools.',
  'Neural gene expression':
    'Neural gene expression studies focus on which genes are active in the nervous system during development, in adulthood, or in disease. Techniques such as in situ hybridization and RNA-seq are used to map expression patterns. This research helps explain brain function and neurological disorders.',
  'Fermentation genomics':
    'Fermentation genomics applies genomic and molecular tools to organisms and processes involved in fermentation, such as yeast and bacteria. It supports the optimization of industrial fermentation for food, biofuels, and bioproducts, and the study of metabolic pathways and stress responses in fermenting organisms.',
};

export const FALLBACK_MESSAGE = 'No additional information is available for this entry at this time.';
