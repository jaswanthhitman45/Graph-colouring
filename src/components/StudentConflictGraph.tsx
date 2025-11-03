import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphLink } from '../types';

interface StudentConflictGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
}

export default function StudentConflictGraph({ nodes, links }: StudentConflictGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;

  const svgEl = svgRef.current as SVGSVGElement;
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    // Responsive width/height based on rendered svg size
    const getSize = () => {
      const rect = svgEl.getBoundingClientRect();
      return {
        width: Math.max(300, rect.width || 800),
        height: Math.max(200, rect.height || 400)
      };
    };

    let { width, height } = getSize();

  const nodeRadius = 30;
    const collisionRadius = nodeRadius + 6;

    // Create simulation with centering forces to keep nodes inside bounds
    const simulation = d3.forceSimulation<GraphNode>(nodes as GraphNode[])
      .force(
        'link',
        d3.forceLink<GraphNode, d3.SimulationLinkDatum<GraphNode>>(links as unknown as d3.SimulationLinkDatum<GraphNode>[]) // links may be GraphLink[]
          .id((d: GraphNode) => d.id)
          .distance(110)
      )
      .force('charge', d3.forceManyBody<GraphNode>().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('x', d3.forceX<GraphNode>(width / 2).strength(0.08))
      .force('y', d3.forceY<GraphNode>(height / 2).strength(0.08))
      .force('collision', d3.forceCollide<GraphNode>().radius(collisionRadius));

    // Create container group
    const container = svg.append("g");

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });
  (svg as d3.Selection<SVGSVGElement, unknown, null, undefined>).call(zoom as d3.ZoomBehavior<SVGSVGElement, unknown>);

    // Create links
    const link = container.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(links)
      .enter().append("line")
      .attr("stroke", "#ff6b6b")
      .attr("stroke-width", 3)
      .attr("stroke-dasharray", "5,5");

    // Create nodes
    const node = container.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(nodes)
      .enter().append("g")
      .attr("class", "node")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on('start', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = undefined;
            d.fy = undefined;
          })
      );

    // Add circles to nodes
    node.append("circle")
      .attr("r", nodeRadius)
      .attr("fill", (d: GraphNode) => d.color || "#64748b")
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .style("cursor", "pointer");

    // Add labels to nodes
    node.append("text")
      .text((d: GraphNode) => {
        // Truncate long course names
        return d.name.length > 8 ? d.name.substring(0, 8) + '...' : d.name;
      })
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("font-size", "10px")
      .attr("font-weight", "bold")
      .attr("fill", "#fff")
      .style("pointer-events", "none");

    // Add full course name on hover
    node.append("title")
      .text((d: GraphNode) => `${d.name}\nSlot: ${d.slot !== undefined ? d.slot + 1 : 'Unassigned'}`);

    // Constrain node positions to the SVG bounds and update positions on tick
    const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
    simulation.on('tick', () => {
      link
        .attr('x1', (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).x as number)
        .attr('y1', (d: d3.SimulationLinkDatum<GraphNode>) => (d.source as GraphNode).y as number)
        .attr('x2', (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).x as number)
        .attr('y2', (d: d3.SimulationLinkDatum<GraphNode>) => (d.target as GraphNode).y as number);

      nodes.forEach((d: GraphNode) => {
        // keep nodes inside the viewport
        d.x = clamp(d.x as number, nodeRadius, width - nodeRadius);
        d.y = clamp(d.y as number, nodeRadius, height - nodeRadius);
      });

      node.attr('transform', (d: GraphNode) => `translate(${d.x},${d.y})`);
    });

    // Add legend
    const legend = svg.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - 180}, 20)`);

    legend.append("rect")
      .attr("width", 160)
      .attr("height", 80)
      .attr("fill", "rgba(255, 255, 255, 0.9)")
      .attr("stroke", "#ccc")
      .attr("rx", 5);

    legend.append("text")
      .attr("x", 10)
      .attr("y", 20)
      .attr("font-size", "12px")
      .attr("font-weight", "bold")
      .text("Legend:");

    legend.append("circle")
      .attr("cx", 20)
      .attr("cy", 35)
      .attr("r", 8)
      .attr("fill", "#64748b");

    legend.append("text")
      .attr("x", 35)
      .attr("y", 40)
      .attr("font-size", "10px")
      .text("Course");

    legend.append("line")
      .attr("x1", 10)
      .attr("y1", 55)
      .attr("x2", 30)
      .attr("y2", 55)
      .attr("stroke", "#ff6b6b")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "3,3");

    legend.append("text")
      .attr("x", 35)
      .attr("y", 60)
      .attr("font-size", "10px")
      .text("Conflict");

    // Watch for resize so the layout recenters and clamps to new size
    const ro = new ResizeObserver(() => {
      const size = getSize();
      width = size.width;
      height = size.height;
      // update center and position forces
      const center = d3.forceCenter(width / 2, height / 2);
      simulation.force("center", center);
  (simulation.force('x') as d3.ForceX<GraphNode>).x(width / 2);
  (simulation.force('y') as d3.ForceY<GraphNode>).y(height / 2);
      simulation.alpha(0.4).restart();
    });
    ro.observe(svgEl);

    return () => {
      ro.disconnect();
      simulation.stop();
    };
  }, [nodes, links]);

  return (
    <div className="w-full h-full">
      <svg
        ref={svgRef}
        width="100%"
        height="400"
        viewBox="0 0 800 400"
        className="border border-slate-200 rounded-lg bg-white"
      >
      </svg>
      <div className="mt-2 text-sm text-slate-600 text-center">
        Drag nodes to rearrange • Scroll to zoom • Hover for details
      </div>
    </div>
  );
}
