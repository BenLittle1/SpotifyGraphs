'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TreemapNode } from '@/app/lib/treemapProcessor';

interface TreemapProps {
  data: TreemapNode;
  width: number;
  height: number;
}

interface D3TreemapNode extends d3.HierarchyRectangularNode<TreemapNode> {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const Treemap: React.FC<TreemapProps> = ({ data, width, height }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [currentRoot, setCurrentRoot] = useState<D3TreemapNode | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);

  useEffect(() => {
    if (!svgRef.current || !data) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 40, right: 0, bottom: 0, left: 0 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Create hierarchy and treemap layout
    const root = d3.hierarchy(data)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const treemap = d3.treemap<TreemapNode>()
      .size([innerWidth, innerHeight])
      .paddingOuter(3)
      .paddingTop(20)
      .paddingInner(2)
      .round(true);

    treemap(root);

    // Set initial root
    if (!currentRoot) {
      setCurrentRoot(root as D3TreemapNode);
    }

    const container = svg
      .attr('width', width)
      .attr('height', height)
      .style('font-family', 'system-ui, sans-serif')
      .style('background', '#0f0f0f');

    // Add gradient definitions
    const defs = container.append('defs');
    
    // Gradient for genres
    const genreGradient = defs.append('linearGradient')
      .attr('id', 'genre-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    genreGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#ff0080')
      .attr('stop-opacity', 0.8);
    genreGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#ff0080')
      .attr('stop-opacity', 0.6);

    // Gradient for artists
    const artistGradient = defs.append('linearGradient')
      .attr('id', 'artist-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    artistGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#00d4ff')
      .attr('stop-opacity', 0.8);
    artistGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#00d4ff')
      .attr('stop-opacity', 0.6);

    // Gradient for tracks
    const trackGradient = defs.append('linearGradient')
      .attr('id', 'track-gradient')
      .attr('gradientUnits', 'userSpaceOnUse');
    trackGradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#00ff88')
      .attr('stop-opacity', 0.8);
    trackGradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#00ff88')
      .attr('stop-opacity', 0.6);

    // Breadcrumb bar
    const breadcrumbBar = container.append('g')
      .attr('class', 'breadcrumb-bar');

    breadcrumbBar.append('rect')
      .attr('width', width)
      .attr('height', margin.top)
      .attr('fill', '#ff8000')
      .style('cursor', 'pointer')
      .on('click', () => zoomOut());

    const breadcrumbText = breadcrumbBar.append('text')
      .attr('x', 10)
      .attr('y', margin.top / 2)
      .attr('dy', '0.35em')
      .style('font-weight', 'bold')
      .style('font-size', '14px')
      .style('fill', '#0f0f0f')
      .style('cursor', 'pointer')
      .on('click', () => zoomOut());

    const mainGroup = container.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    let currentDisplay = currentRoot || root;

    // Color scale
    const getNodeColor = (d: d3.HierarchyRectangularNode<TreemapNode>) => {
      if (d.data.type === 'genre') return 'url(#genre-gradient)';
      if (d.data.type === 'artist') return 'url(#artist-gradient)';
      return 'url(#track-gradient)';
    };

    // Add drop shadow filter
    const filter = defs.append('filter')
      .attr('id', 'drop-shadow')
      .attr('height', '130%');
    
    filter.append('feGaussianBlur')
      .attr('in', 'SourceAlpha')
      .attr('stdDeviation', 3);
    
    filter.append('feOffset')
      .attr('dx', 2)
      .attr('dy', 2)
      .attr('result', 'offset');
    
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'offset');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    function render(displayRoot: D3TreemapNode) {
      // Scale for current view
      const x = d3.scaleLinear()
        .domain([displayRoot.x0, displayRoot.x1])
        .range([0, innerWidth]);
      
      const y = d3.scaleLinear()
        .domain([displayRoot.y0, displayRoot.y1])
        .range([0, innerHeight]);

      // Update breadcrumb
      breadcrumbText.text(
        displayRoot.parent
          ? `${displayRoot.data.name} - Click to zoom out`
          : 'Music Library - Click rectangles to zoom in'
      );

      // Get visible nodes
      const nodes = displayRoot.descendants()
        .filter(d => d.depth <= displayRoot.depth + 1);

      // Bind data
      const node = mainGroup.selectAll('.node')
        .data(nodes, (d: any) => d.data.name + d.depth);

      // Enter new nodes
      const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .style('cursor', d => d.children ? 'pointer' : 'default');

      // Add rectangles
      nodeEnter.append('rect')
        .attr('class', 'node-rect')
        .attr('fill', getNodeColor)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1)
        .style('filter', 'url(#drop-shadow)')
        .on('click', (event, d) => {
          if (d.children && d !== displayRoot) {
            zoomTo(d as D3TreemapNode);
          } else if (d.data.spotifyUrl) {
            window.open(d.data.spotifyUrl, '_blank');
          }
        })
        .on('mouseover', function(event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .style('filter', 'url(#drop-shadow) brightness(1.2)');
        })
        .on('mouseout', function(event, d) {
          d3.select(this)
            .transition()
            .duration(200)
            .style('filter', 'url(#drop-shadow)');
        });

      // Add text
      nodeEnter.append('text')
        .attr('class', 'node-text')
        .style('font-size', '12px')
        .style('font-weight', 'bold')
        .style('fill', '#ffffff')
        .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
        .style('pointer-events', 'none')
        .style('text-anchor', 'middle')
        .style('dominant-baseline', 'middle')
        .each(function(d) {
          const text = d3.select(this);
          const rectWidth = x(d.x1) - x(d.x0);
          const rectHeight = y(d.y1) - y(d.y0);
          
          // Only show text if rectangle is large enough
          if (rectWidth > 40 && rectHeight > 20) {
            const maxChars = Math.max(5, Math.floor(rectWidth / 8));
            let displayText = d.data.name;
            if (displayText.length > maxChars) {
              displayText = displayText.substring(0, maxChars - 3) + '...';
            }
            text.text(displayText);
            
            // Add popularity info for larger rectangles
            if (rectWidth > 80 && rectHeight > 40 && d.data.popularity) {
              text.append('tspan')
                .attr('x', 0)
                .attr('dy', '1.2em')
                .style('font-size', '10px')
                .style('font-weight', 'normal')
                .style('fill', '#cccccc')
                .text(`♪ ${d.data.popularity}`);
            }
          }
        });

      // Update positions
      const nodeUpdate = nodeEnter.merge(node as any);
      
      nodeUpdate.select('.node-rect')
        .transition()
        .duration(750)
        .attr('x', d => x(d.x0))
        .attr('y', d => y(d.y0))
        .attr('width', d => Math.max(0, x(d.x1) - x(d.x0)))
        .attr('height', d => Math.max(0, y(d.y1) - y(d.y0)));

      nodeUpdate.select('.node-text')
        .transition()
        .duration(750)
        .attr('x', d => x(d.x0) + (x(d.x1) - x(d.x0)) / 2)
        .attr('y', d => y(d.y0) + (y(d.y1) - y(d.y0)) / 2);

      // Remove old nodes
      node.exit()
        .transition()
        .duration(750)
        .style('opacity', 0)
        .remove();
    }

    function zoomTo(target: D3TreemapNode) {
      setCurrentRoot(target);
      
      // Update breadcrumbs
      const newBreadcrumbs: string[] = [];
      let current: any = target;
      while (current.parent) {
        newBreadcrumbs.unshift(current.data.name);
        current = current.parent;
      }
      setBreadcrumbs(newBreadcrumbs);
      
      render(target);
    }

    function zoomOut() {
      if (currentDisplay.parent) {
        zoomTo(currentDisplay.parent as D3TreemapNode);
      }
    }

    // Initial render
    render(currentDisplay as D3TreemapNode);

  }, [data, width, height, currentRoot]);

  return (
    <div className="treemap-container">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        style={{ display: 'block', background: '#0f0f0f' }}
      />
      
      {breadcrumbs.length > 0 && (
        <div className="absolute top-12 left-4 text-sm text-gray-400">
          <span className="text-neon-orange">Path:</span> {breadcrumbs.join(' → ')}
        </div>
      )}
    </div>
  );
};

export default Treemap; 